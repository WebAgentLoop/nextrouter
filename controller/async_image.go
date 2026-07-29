package controller

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

func SubmitAsyncImageGeneration(c *gin.Context) {
	if !relay.AsyncImageGenerationEnabled() {
		respondAsyncImageError(c, http.StatusServiceUnavailable, "async_image_disabled", "async image generation is disabled")
		return
	}
	request, err := helper.GetAndValidateRequest(c, types.RelayFormatOpenAIImage)
	if err != nil {
		respondAsyncImageError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	imageRequest := request.(*dto.ImageRequest)
	if imageRequest.Stream != nil && *imageRequest.Stream {
		respondAsyncImageError(c, http.StatusBadRequest, "invalid_request", "stream is not supported for async image generation")
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIImage, request, nil)
	if err != nil {
		respondAsyncImageError(c, http.StatusInternalServerError, "gen_relay_info_failed", err.Error())
		return
	}
	meta := request.GetTokenCountMeta()
	if setting.ShouldCheckPromptSensitive() {
		if contains, words := service.CheckSensitiveText(meta.CombineText); contains {
			respondAsyncImageError(c, http.StatusBadRequest, "sensitive_words_detected", "sensitive words detected: "+common.LocalLogPreview(strings.Join(words, ", ")))
			return
		}
	}
	tokens, err := service.EstimateRequestToken(c, meta, relayInfo)
	if err != nil {
		respondAsyncImageError(c, http.StatusBadRequest, "count_token_failed", err.Error())
		return
	}
	relayInfo.SetEstimatePromptTokens(tokens)
	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		respondAsyncImageError(c, http.StatusBadRequest, "model_price_error", err.Error())
		return
	}

	pending, err := model.CountPendingAsyncImageTasks(relayInfo.UserId)
	if err != nil {
		respondAsyncImageError(c, http.StatusInternalServerError, "task_query_failed", err.Error())
		return
	}
	if pending >= int64(relay.AsyncImageMaxPendingPerUser()) {
		respondAsyncImageError(c, http.StatusTooManyRequests, "too_many_pending_tasks", "too many pending image generation tasks")
		return
	}

	relayInfo.ForcePreConsume = true
	if !priceData.FreeModel {
		if apiErr := service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo); apiErr != nil {
			c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
			return
		}
	}
	committed := false
	defer func() {
		if !committed && relayInfo.Billing != nil {
			relayInfo.Billing.Refund(c)
		}
	}()

	relayInfo.InitChannelMeta(c)
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		respondAsyncImageError(c, http.StatusBadRequest, "read_request_failed", err.Error())
		return
	}
	requestJSON, err := io.ReadAll(common.ReaderOnly(storage))
	if err != nil {
		respondAsyncImageError(c, http.StatusInternalServerError, "read_request_failed", err.Error())
		return
	}
	task := model.InitTask(constant.TaskPlatformAsyncImage, relayInfo)
	task.TaskID = model.GenerateAsyncImageTaskID()
	task.Status = model.TaskStatusQueued
	task.Action = "images.generations"
	task.Quota = relayInfo.FinalPreConsumedQuota
	task.PrivateData.BillingSource = relayInfo.BillingSource
	task.PrivateData.SubscriptionId = relayInfo.SubscriptionId
	task.PrivateData.TokenId = relayInfo.TokenId
	task.PrivateData.NodeName = common.NodeName
	task.PrivateData.TokenName = c.GetString("token_name")
	task.PrivateData.AsyncImageRequest = requestJSON
	task.PrivateData.TieredBilling = relayInfo.TieredBillingSnapshot
	task.PrivateData.BillingRequest = relayInfo.BillingRequestInput
	task.PrivateData.AsyncImagePrice = &model.AsyncImagePriceSnapshot{
		ModelPrice: priceData.ModelPrice, ModelRatio: priceData.ModelRatio,
		CompletionRatio: priceData.CompletionRatio, CacheRatio: priceData.CacheRatio,
		CacheCreationRatio: priceData.CacheCreationRatio, CacheCreation5mRatio: priceData.CacheCreation5mRatio,
		CacheCreation1hRatio: priceData.CacheCreation1hRatio, ImageRatio: priceData.ImageRatio,
		AudioRatio: priceData.AudioRatio, AudioCompletionRatio: priceData.AudioCompletionRatio,
		OtherRatios: priceData.OtherRatios(), UsePrice: priceData.UsePrice,
		GroupRatio: priceData.GroupRatioInfo.GroupRatio, GroupSpecialRatio: priceData.GroupRatioInfo.GroupSpecialRatio,
		HasSpecialRatio: priceData.GroupRatioInfo.HasSpecialRatio,
	}
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelPrice: priceData.ModelPrice, GroupRatio: priceData.GroupRatioInfo.GroupRatio,
		ModelRatio: priceData.ModelRatio, OtherRatios: priceData.OtherRatios(), OriginModelName: relayInfo.OriginModelName,
		PerCallBilling: priceData.UsePrice,
	}
	if err := task.Insert(); err != nil {
		respondAsyncImageError(c, http.StatusInternalServerError, "insert_task_failed", err.Error())
		return
	}
	if err := service.SettleBilling(c, relayInfo, task.Quota); err != nil {
		task.Status = model.TaskStatusFailure
		task.Progress = "100%"
		task.FailReason = err.Error()
		_ = task.Update()
		respondAsyncImageError(c, http.StatusInternalServerError, "settle_billing_failed", err.Error())
		return
	}
	committed = true
	relay.NotifyAsyncImageWorker()
	c.Header("Location", "/v1/images/generations/tasks/"+task.TaskID)
	c.Header("Retry-After", "2")
	c.JSON(http.StatusAccepted, gin.H{
		"id": task.TaskID, "object": "image.generation.task", "status": "queued",
		"created_at": task.SubmitTime, "model": relayInfo.OriginModelName,
	})
}

func GetAsyncImageGenerationTask(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	task, exists, err := model.GetByTaskId(c.GetInt("id"), c.Param("task_id"))
	if err != nil {
		respondAsyncImageError(c, http.StatusInternalServerError, "get_task_failed", err.Error())
		return
	}
	if !exists || task.Platform != constant.TaskPlatformAsyncImage {
		respondAsyncImageError(c, http.StatusNotFound, "task_not_found", "image generation task not found")
		return
	}
	if task.ExpiresAt > 0 && task.ExpiresAt <= time.Now().Unix() {
		respondAsyncImageError(c, http.StatusGone, "task_expired", "image generation task has expired")
		return
	}

	response := gin.H{
		"id": task.TaskID, "object": "image.generation.task", "status": asyncImageStatus(task.Status),
		"created_at": task.SubmitTime, "model": task.Properties.OriginModelName,
	}
	if task.StartTime > 0 {
		response["started_at"] = task.StartTime
	}
	if task.FinishTime > 0 {
		response["completed_at"] = task.FinishTime
		response["expires_at"] = task.ExpiresAt
	}
	if task.Status == model.TaskStatusSuccess {
		response["result"] = json.RawMessage(task.AsyncImageResult)
	}
	if task.Status == model.TaskStatusFailure {
		response["error"] = gin.H{"message": task.FailReason, "type": "image_generation_failed", "code": "image_generation_failed"}
	}
	c.JSON(http.StatusOK, response)
}

func asyncImageStatus(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusQueued, model.TaskStatusSubmitted, model.TaskStatusNotStart:
		return "queued"
	case model.TaskStatusInProgress:
		return "running"
	case model.TaskStatusSuccess:
		return "completed"
	case model.TaskStatusFailure:
		return "failed"
	default:
		return "unknown"
	}
}

func respondAsyncImageError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{"message": message, "type": code, "code": code}})
}
