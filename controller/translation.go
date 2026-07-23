package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/translation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

var translationLanguageNames = map[string]string{
	"zh-CN": "Simplified Chinese",
	"zh-TW": "Traditional Chinese",
	"en":    "English",
	"ja":    "Japanese",
	"fr":    "French",
	"ru":    "Russian",
	"vi":    "Vietnamese",
}

type modelTranslationTaskPayload struct {
	ModelID     int      `json:"model_id"`
	Locales     []string `json:"locales"`
	Contents    []string `json:"contents"`
	RequestedBy int      `json:"requested_by"`
}

type generateModelTranslationsRequest struct {
	Locales  []string `json:"locales"`
	Contents []string `json:"contents"`
}

type updateModelTranslationRequest struct {
	Description                *string `json:"description"`
	Documentation              *string `json:"documentation"`
	DescriptionSourceVersion   string  `json:"description_source_version"`
	DocumentationSourceVersion string  `json:"documentation_source_version"`
}

type modelTranslationFailure struct {
	Locale  string `json:"locale"`
	Content string `json:"content"`
	Error   string `json:"error"`
}

func ListModelTranslations(c *gin.Context) {
	modelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var source model.Model
	if err := model.DB.First(&source, modelID).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	translations, err := model.ListModelTranslations(modelID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"model":        source,
		"translations": translations,
		"settings":     translation_setting.GetTranslationSetting(),
		"source_versions": gin.H{
			"description":   model.ModelSourceVersionHash(source.SourceLanguage, source.Description),
			"documentation": model.ModelSourceVersionHash(source.SourceLanguage, source.Documentation),
		},
	})
}

func GenerateModelTranslations(c *gin.Context) {
	setting := translation_setting.GetTranslationSetting()
	if !setting.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "model content translation is disabled"})
		return
	}
	modelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var source model.Model
	if err := model.DB.First(&source, modelID).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var request generateModelTranslationsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	locales, err := normalizeTranslationLocales(request.Locales, source.SourceLanguage)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	contents, err := normalizeTranslationContents(request.Contents)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	payload := modelTranslationTaskPayload{ModelID: modelID, Locales: locales, Contents: contents, RequestedBy: c.GetInt("id")}
	activeKey := fmt.Sprintf("model_translation:%d", modelID)
	task, created, err := service.EnqueueSystemTaskWithActiveKeyAndSetup(model.SystemTaskTypeModelTranslation, activeKey, payload, func(tx *gorm.DB) error {
		for _, locale := range locales {
			if err := model.SetModelTranslationPendingWithTx(tx, modelID, locale, contents); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !created {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "a translation task is already active for this model", "data": task.ToResponse()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"success": true, "data": task.ToResponse()})
}

func UpdateModelTranslation(c *gin.Context) {
	modelID, locale, _, ok := loadTranslationTarget(c)
	if !ok {
		return
	}
	var request updateModelTranslationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if request.Description == nil && request.Documentation == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "description or documentation is required"})
		return
	}
	if request.Documentation != nil && len([]byte(*request.Documentation)) > model.MaxModelDocumentationBytes {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "translated documentation must not exceed 32 KiB"})
		return
	}
	if request.Description != nil && request.DescriptionSourceVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "description source version is required"})
		return
	}
	if request.Documentation != nil && request.DocumentationSourceVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "documentation source version is required"})
		return
	}
	translation, err := model.SaveManualModelTranslation(modelID, locale, model.ManualModelTranslationUpdate{
		Description:                request.Description,
		Documentation:              request.Documentation,
		DescriptionSourceVersion:   request.DescriptionSourceVersion,
		DocumentationSourceVersion: request.DocumentationSourceVersion,
	})
	if err != nil {
		if errors.Is(err, model.ErrModelTranslationSourceChanged) {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"code":    "MODEL_TRANSLATION_SOURCE_CHANGED",
				"message": "source model content changed; refresh and review the translation before saving",
			})
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, translation)
}

func DeleteModelTranslation(c *gin.Context) {
	modelID, locale, _, ok := loadTranslationTarget(c)
	if !ok {
		return
	}
	if err := model.DeleteModelTranslation(modelID, locale); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func loadTranslationTarget(c *gin.Context) (int, string, *model.Model, bool) {
	modelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return 0, "", nil, false
	}
	locale := translation_setting.NormalizeLanguage(c.Param("locale"))
	if locale == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "unsupported locale"})
		return 0, "", nil, false
	}
	var source model.Model
	if err := model.DB.First(&source, modelID).Error; err != nil {
		common.ApiError(c, err)
		return 0, "", nil, false
	}
	if locale == source.SourceLanguage {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "source language does not need a translation"})
		return 0, "", nil, false
	}
	return modelID, locale, &source, true
}

func normalizeTranslationLocales(values []string, sourceLanguage string) ([]string, error) {
	seen := map[string]struct{}{}
	locales := make([]string, 0, len(values))
	for _, value := range values {
		locale := translation_setting.NormalizeLanguage(value)
		if locale == "" {
			return nil, fmt.Errorf("unsupported locale %q", value)
		}
		if locale == sourceLanguage {
			continue
		}
		if _, exists := seen[locale]; exists {
			continue
		}
		seen[locale] = struct{}{}
		locales = append(locales, locale)
	}
	if len(locales) == 0 {
		return nil, errors.New("at least one target locale is required")
	}
	return locales, nil
}

func normalizeTranslationContents(values []string) ([]string, error) {
	if len(values) == 0 {
		values = []string{"description", "documentation"}
	}
	seen := map[string]struct{}{}
	contents := make([]string, 0, len(values))
	for _, value := range values {
		if value != "description" && value != "documentation" {
			return nil, fmt.Errorf("unsupported translation content %q", value)
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		contents = append(contents, value)
	}
	return contents, nil
}

func runModelTranslationTask(ctx context.Context, task *model.SystemTask, runnerID string) {
	var payload modelTranslationTaskPayload
	if err := task.DecodePayload(&payload); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("model translation task payload is invalid: task_id=%s error=%v", task.TaskID, err))
		_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed, nil, err.Error())
		return
	}
	var source model.Model
	if err := model.DB.First(&source, payload.ModelID).Error; err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("model translation source lookup failed: task_id=%s model_id=%d error=%v", task.TaskID, payload.ModelID, err))
		_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed, nil, err.Error())
		return
	}
	completed := 0
	failed := 0
	failures := make([]modelTranslationFailure, 0)
	for _, locale := range payload.Locales {
		for _, content := range payload.Contents {
			if ctx.Err() != nil {
				_ = model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed, nil, ctx.Err().Error())
				return
			}
			value := source.Description
			if content == "documentation" {
				value = source.Documentation
			}
			if strings.TrimSpace(value) == "" {
				if err := model.SaveModelTranslation(source.Id, locale, content, "", model.ModelContentHash(value)); err != nil {
					failures = append(failures, recordModelTranslationFailure(ctx, task.TaskID, source.Id, locale, content, err))
					failed++
				} else {
					completed++
				}
				continue
			}
			if err := model.SetModelTranslationRunning(source.Id, locale, content); err != nil {
				failures = append(failures, recordModelTranslationFailure(ctx, task.TaskID, source.Id, locale, content, err))
				failed++
				continue
			}
			sourceHash := model.ModelContentHash(value)
			translated, err := callLLMTranslate(ctx, payload.RequestedBy, value, source.SourceLanguage, locale, content)
			if err != nil {
				failures = append(failures, recordModelTranslationFailure(ctx, task.TaskID, source.Id, locale, content, err))
				failed++
				continue
			}
			if content == "documentation" && len([]byte(translated)) > model.MaxModelDocumentationBytes {
				err := errors.New("translated documentation exceeds 32 KiB")
				failures = append(failures, recordModelTranslationFailure(ctx, task.TaskID, source.Id, locale, content, err))
				failed++
				continue
			}
			var latest model.Model
			if err := model.DB.First(&latest, source.Id).Error; err != nil {
				failures = append(failures, recordModelTranslationFailure(ctx, task.TaskID, source.Id, locale, content, err))
				failed++
				continue
			}
			latestValue := latest.Description
			if content == "documentation" {
				latestValue = latest.Documentation
			}
			if latest.SourceLanguage != source.SourceLanguage || model.ModelContentHash(latestValue) != sourceHash {
				_ = model.StaleModelTranslation(source.Id, locale, content)
				failed++
				continue
			}
			if err := model.SaveModelTranslation(source.Id, locale, content, strings.TrimSpace(translated), sourceHash); err != nil {
				failures = append(failures, recordModelTranslationFailure(ctx, task.TaskID, source.Id, locale, content, err))
				failed++
				continue
			}
			completed++
		}
	}
	status := model.SystemTaskStatusSucceeded
	errorMessage := ""
	if failed > 0 {
		status = model.SystemTaskStatusFailed
		errorMessage = fmt.Sprintf("%d translation fields failed", failed)
		if len(failures) > 0 {
			errorMessage = fmt.Sprintf("%s; first failure (%s/%s): %s", errorMessage, failures[0].Locale, failures[0].Content, failures[0].Error)
		}
	}
	_ = model.FinishSystemTask(task.TaskID, runnerID, status, gin.H{"completed": completed, "failed": failed, "failures": failures}, errorMessage)
}

func recordModelTranslationFailure(ctx context.Context, taskID string, modelID int, locale, content string, translateErr error) modelTranslationFailure {
	_ = model.FailModelTranslation(modelID, locale, content, translateErr)
	failure := modelTranslationFailure{Locale: locale, Content: content, Error: strings.TrimSpace(translateErr.Error())}
	logger.LogWarn(ctx, fmt.Sprintf("model translation failed: task_id=%s model_id=%d locale=%s content=%s error=%s", taskID, modelID, locale, content, failure.Error))
	return failure
}

func callLLMTranslate(ctx context.Context, userID int, source, sourceLanguage, targetLanguage, contentType string) (string, error) {
	targetName := translationLanguageNames[targetLanguage]
	sourceName := translationLanguageNames[sourceLanguage]
	if targetName == "" || sourceName == "" {
		return "", errors.New("unsupported translation language")
	}
	rules := "Translate only natural-language prose. Keep URLs, model names, code identifiers, and technical terms unchanged."
	if contentType == "documentation" {
		rules += " Preserve all Markdown structure. Do not translate fenced code blocks, inline code, URLs, image URLs, or YAML frontmatter keys."
	}
	systemPrompt := fmt.Sprintf("You are a professional technical translator. Translate the following %s from %s into %s. %s Output only the translation without a preamble or wrapper.", contentType, sourceName, targetName, rules)
	messages := []dto.Message{{Role: "system", Content: systemPrompt}, {Role: "user", Content: source}}
	setting := translation_setting.GetTranslationSetting()
	return internalTranslationChatComplete(ctx, userID, setting.Group, setting.Model, messages)
}

func internalTranslationChatComplete(ctx context.Context, userID int, group, modelName string, messages []dto.Message) (string, error) {
	channel, err := model.GetRandomSatisfiedChannel(group, modelName, 0, "/v1/chat/completions")
	if err != nil {
		return "", fmt.Errorf("select translation channel for model %q in group %q: %w", modelName, group, err)
	}
	if channel == nil {
		return "", fmt.Errorf("no chat-completions channel is available for translation model %q in group %q", modelName, group)
	}
	if userID <= 0 {
		userID, err = resolveChannelTestUserID(nil)
		if err != nil {
			return "", err
		}
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequestWithContext(ctx, http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	user, err := model.GetUserCache(userID)
	if err != nil {
		return "", err
	}
	user.WriteContext(c)
	c.Set("id", userID)
	c.Set("channel", channel.Type)
	c.Set("base_url", channel.GetBaseURL())
	c.Set("group", group)
	c.Set("token_name", "模型内容翻译")
	if apiErr := middleware.SetupContextForSelectedChannel(c, channel, modelName); apiErr != nil {
		return "", fmt.Errorf("prepare translation channel #%d (%s): %w", channel.Id, channel.Name, apiErr)
	}
	maxTokens := uint(8192)
	request := &dto.GeneralOpenAIRequest{Model: modelName, Stream: lo.ToPtr(false), Messages: messages, MaxTokens: lo.ToPtr(maxTokens)}
	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, request, nil)
	if err != nil {
		return "", err
	}
	// Internal admin actions have no API token. Playground semantics preserve
	// normal wallet/subscription billing while skipping token-quota accounting.
	info.IsPlayground = true
	info.InitChannelMeta(c)
	if err := helper.ModelMappedHelper(c, info, request); err != nil {
		return "", err
	}
	request.SetModelName(info.UpstreamModelName)
	meta := request.GetTokenCountMeta()
	tokens, err := service.EstimateRequestToken(c, meta, info)
	if err != nil {
		return "", err
	}
	info.SetEstimatePromptTokens(tokens)
	if err := attachTestBillingRequestInput(info, request); err != nil {
		return "", err
	}
	priceData, err := helper.ModelPriceHelper(c, info, tokens, meta)
	if err != nil {
		return "", err
	}
	if !priceData.FreeModel {
		if apiErr := service.PreConsumeBilling(c, priceData.QuotaToPreConsume, info); apiErr != nil {
			return "", fmt.Errorf("pre-consume translation billing via channel #%d (%s), model %q, group %q: %w", channel.Id, channel.Name, modelName, group, apiErr)
		}
	}
	settled := false
	defer func() {
		if !settled && info.Billing != nil {
			info.Billing.Refund(c)
		}
	}()
	apiType, _ := common.ChannelType2APIType(channel.Type)
	adaptor := relay.GetAdaptor(apiType)
	if adaptor == nil {
		return "", fmt.Errorf("no adaptor for api type %d", apiType)
	}
	adaptor.Init(info)
	convertedRequest, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		return "", err
	}
	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return "", err
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
	response, err := adaptor.DoRequest(c, info, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("translation request via channel #%d (%s), model %q: %w", channel.Id, channel.Name, modelName, err)
	}
	httpResponse, _ := response.(*http.Response)
	if httpResponse == nil || httpResponse.StatusCode != http.StatusOK {
		status := 0
		var upstreamErr error
		if httpResponse != nil {
			status = httpResponse.StatusCode
			upstreamErr = service.RelayErrorHandler(ctx, httpResponse, true)
		}
		if upstreamErr != nil {
			return "", fmt.Errorf("translation upstream via channel #%d (%s), model %q returned status %d: %w", channel.Id, channel.Name, modelName, status, upstreamErr)
		}
		return "", fmt.Errorf("translation upstream via channel #%d (%s), model %q returned status %d", channel.Id, channel.Name, modelName, status)
	}
	usageValue, apiErr := adaptor.DoResponse(c, httpResponse, info)
	if apiErr != nil {
		return "", fmt.Errorf("decode translation response from channel #%d (%s), model %q: %w", channel.Id, channel.Name, modelName, apiErr)
	}
	usage, err := coerceTestUsage(usageValue, false, info.GetEstimatePromptTokens())
	if err != nil {
		return "", err
	}
	service.PostTextConsumeQuota(c, info, usage, []string{"模型内容翻译"})
	settled = true
	content := strings.TrimSpace(gjson.GetBytes(recorder.Body.Bytes(), "choices.0.message.content").String())
	if content == "" {
		return "", errors.New("translation produced empty content")
	}
	return content, nil
}
