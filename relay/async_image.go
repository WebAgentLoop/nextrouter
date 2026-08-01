package relay

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	asyncImageDefaultConcurrency = 10
	asyncImageMaxConcurrency     = 128
	asyncImageLeaseDuration      = 60 * time.Second
	asyncImagePollInterval       = 2 * time.Second
	asyncImageCleanupInterval    = 15 * time.Minute
	asyncImageCleanupBatch       = 500
)

var asyncImageWakeup = make(chan struct{}, 1)

func NotifyAsyncImageWorker() {
	select {
	case asyncImageWakeup <- struct{}{}:
	default:
	}
}

func AsyncImageGenerationEnabled() bool {
	value := strings.TrimSpace(os.Getenv("ASYNC_IMAGE_GENERATION_ENABLED"))
	if value == "" {
		return true
	}
	enabled, err := strconv.ParseBool(value)
	return err == nil && enabled
}

func AsyncImageMaxPendingPerUser() int {
	return operation_setting.GetAsyncImageSetting().MaxPendingPerUser
}

func StartAsyncImageWorkers() {
	if !AsyncImageGenerationEnabled() {
		return
	}
	concurrency := asyncImageWorkerConcurrency()
	for i := 0; i < concurrency; i++ {
		runnerID := fmt.Sprintf("%s-image-%d-%s", common.NodeName, i, common.GetRandomString(8))
		go runAsyncImageWorker(runnerID)
	}
	go runAsyncImageCleanup()
}

func asyncImageWorkerConcurrency() int {
	raw := strings.TrimSpace(os.Getenv("ASYNC_IMAGE_WORKER_CONCURRENCY"))
	if raw == "" {
		return asyncImageDefaultConcurrency
	}
	concurrency, err := strconv.Atoi(raw)
	if err != nil || concurrency < 1 || concurrency > asyncImageMaxConcurrency {
		logger.LogWarn(context.Background(), fmt.Sprintf(
			"ASYNC_IMAGE_WORKER_CONCURRENCY must be between 1 and %d; using default %d",
			asyncImageMaxConcurrency, asyncImageDefaultConcurrency,
		))
		return asyncImageDefaultConcurrency
	}
	return concurrency
}

func runAsyncImageWorker(runnerID string) {
	ticker := time.NewTicker(asyncImagePollInterval)
	defer ticker.Stop()
	for {
		runAsyncImageWorkerPass(runnerID)
		select {
		case <-ticker.C:
		case <-asyncImageWakeup:
		}
	}
}

func runAsyncImageWorkerPass(runnerID string) {
	now := time.Now().Unix()
	tasks, err := model.ClaimAsyncImageTasks(runnerID, now, now+int64(asyncImageLeaseDuration.Seconds()), 1)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("claim async image task failed: %v", err))
		return
	}
	for _, task := range tasks {
		executeAsyncImageTask(runnerID, task)
	}
}

func executeAsyncImageTask(runnerID string, task *model.Task) {
	ctx, cancel := context.WithTimeout(context.Background(), asyncImageUpstreamTimeout())
	defer cancel()

	heartbeatDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(asyncImageLeaseDuration / 3)
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatDone:
				return
			case <-ticker.C:
				if !model.RenewAsyncImageTaskLease(task.TaskID, runnerID, time.Now().Add(asyncImageLeaseDuration).Unix()) {
					cancel()
					return
				}
			}
		}
	}()
	defer close(heartbeatDone)
	if task.BillingStatus == "settling" && len(task.AsyncImageResult) > 0 {
		completedAt := time.Now().Unix()
		won, err := model.FinishAsyncImageTask(task.TaskID, runnerID, model.TaskStatusSuccess,
			task.AsyncImageResult, "", completedAt, completedAt+int64(asyncImageRetentionDuration().Seconds()))
		if err != nil || !won {
			logger.LogWarn(ctx, fmt.Sprintf("recover async image settlement task=%s won=%t err=%v", task.TaskID, won, err))
		}
		return
	}

	fail := func(err error) {
		reason := common.LocalLogPreview(err.Error())
		service.RefundTaskQuota(ctx, task, reason)
		now := time.Now().Unix()
		won, updateErr := model.FinishAsyncImageTask(task.TaskID, runnerID, model.TaskStatusFailure, nil, reason, now, now+int64(asyncImageRetentionDuration().Seconds()))
		if updateErr != nil || !won {
			logger.LogWarn(ctx, fmt.Sprintf("finish async image failure task=%s won=%t err=%v", task.TaskID, won, updateErr))
		}
	}

	var imageRequest dto.ImageRequest
	if err := common.Unmarshal(task.PrivateData.AsyncImageRequest, &imageRequest); err != nil {
		fail(fmt.Errorf("decode async image request: %w", err))
		return
	}
	var initialChannel *model.Channel
	channel, err := model.GetChannelById(task.ChannelId, true)
	if err == nil && channel != nil && channel.Status == common.ChannelStatusEnabled {
		initialChannel = channel
	}
	token, err := model.GetTokenById(task.PrivateData.TokenId)
	if err != nil {
		fail(fmt.Errorf("load token: %w", err))
		return
	}
	user, err := model.GetUserById(task.UserId, false)
	if err != nil {
		fail(fmt.Errorf("load user: %w", err))
		return
	}

	recorder := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(recorder, gin.New())
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "/v1/images/generations", bytes.NewReader(task.PrivateData.AsyncImageRequest))
	if err != nil {
		fail(err)
		return
	}
	request.Header.Set("Content-Type", "application/json")
	c.Request = request
	c.Set(common.RequestIdKey, common.NewRequestId())
	c.Set("id", task.UserId)
	c.Set("token_id", token.Id)
	c.Set("token_key", token.Key)
	c.Set("token_name", task.PrivateData.TokenName)
	c.Set("token_unlimited_quota", token.UnlimitedQuota)
	c.Set("token_quota", token.RemainQuota)
	c.Set("group", task.Group)
	c.Set("original_model", task.Properties.OriginModelName)
	common.SetContextKey(c, constant.ContextKeyUserId, task.UserId)
	common.SetContextKey(c, constant.ContextKeyUserGroup, user.Group)
	common.SetContextKey(c, constant.ContextKeyUserQuota, user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserEmail, user.Email)
	common.SetContextKey(c, constant.ContextKeyUserSetting, user.GetSetting())
	common.SetContextKey(c, constant.ContextKeyUsingGroup, task.Group)
	tokenGroup := token.Group
	if tokenGroup == "" {
		tokenGroup = user.Group
	}
	common.SetContextKey(c, constant.ContextKeyTokenGroup, tokenGroup)
	common.SetContextKey(c, constant.ContextKeyTokenCrossGroupRetry, token.CrossGroupRetry)
	common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
	if tokenGroup == "auto" {
		common.SetContextKey(c, constant.ContextKeyAutoGroup, task.Group)
		for index, group := range service.GetUserAutoGroup(user.Group) {
			if group == task.Group {
				common.SetContextKey(c, constant.ContextKeyAutoGroupIndex, index)
				break
			}
		}
	}
	c.Set("use_channel", []string{})
	if routing := task.PrivateData.AsyncImageRouting; routing != nil {
		if routing.SpecificChannel {
			c.Set("specific_channel_id", strconv.Itoa(task.ChannelId))
		}
		service.RestoreChannelAffinitySkipRetry(c, routing.SkipRetry)
	}
	defer common.CleanupBodyStorage(c)

	priceData := restoreAsyncImagePrice(task.PrivateData.AsyncImagePrice)
	relayInfo := &relaycommon.RelayInfo{
		TokenId: task.PrivateData.TokenId, TokenKey: token.Key, UserId: task.UserId,
		UsingGroup: task.Group, UserGroup: user.Group, StartTime: time.Now(),
		TokenGroup: tokenGroup, TokenUnlimited: token.UnlimitedQuota,
		UserQuota: user.Quota, UserEmail: user.Email, UserSetting: user.GetSetting(),
		RelayMode: relayconstant.RelayModeImagesGenerations, RelayFormat: relaytypes.RelayFormatOpenAIImage,
		OriginModelName: task.Properties.OriginModelName, RequestURLPath: "/v1/images/generations",
		Request: &imageRequest, PriceData: priceData, FinalPreConsumedQuota: task.Quota,
		BillingSource: task.PrivateData.BillingSource, SubscriptionId: task.PrivateData.SubscriptionId,
		TieredBillingSnapshot: task.PrivateData.TieredBilling, BillingRequestInput: task.PrivateData.BillingRequest,
	}
	usage, apiErr := executeAsyncImageWithRetry(c, relayInfo, initialChannel)
	if apiErr != nil {
		fail(apiErr)
		return
	}

	result := append([]byte(nil), recorder.Body.Bytes()...)
	settlementOwned, err := model.BeginAsyncImageSettlement(task.TaskID, runnerID, result)
	if err != nil || !settlementOwned {
		logger.LogWarn(ctx, fmt.Sprintf("begin async image settlement task=%s owned=%t err=%v", task.TaskID, settlementOwned, err))
		return
	}
	task.BillingStatus = "settling"
	task.AsyncImageResult = result
	actualQuota := service.PostTextConsumeQuota(c, relayInfo, usage, []string{"异步图片生成"})
	task.Quota = actualQuota
	if err := task.UpdateQuota(); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("update async image quota task=%s: %v", task.TaskID, err))
	}
	completedAt := time.Now().Unix()
	won, err := model.FinishAsyncImageTask(task.TaskID, runnerID, model.TaskStatusSuccess, result, "", completedAt, completedAt+int64(asyncImageRetentionDuration().Seconds()))
	if err != nil || !won {
		logger.LogWarn(ctx, fmt.Sprintf("finish async image success task=%s won=%t err=%v", task.TaskID, won, err))
	}
}

func executeAsyncImageWithRetry(c *gin.Context, relayInfo *relaycommon.RelayInfo, initialChannel *model.Channel) (*dto.Usage, *relaytypes.NewAPIError) {
	retryParam := &service.RetryParam{
		Ctx:         c,
		TokenGroup:  relayInfo.TokenGroup,
		ModelName:   relayInfo.OriginModelName,
		RequestPath: c.Request.URL.Path,
		Retry:       common.GetPointer(0),
	}
	relayInfo.RetryIndex = 0
	relayInfo.LastError = nil

	var usage *dto.Usage
	var apiErr *relaytypes.NewAPIError
	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		relayInfo.RetryIndex = retryParam.GetRetry()
		channel, channelErr := selectAsyncImageChannel(c, relayInfo, retryParam, initialChannel)
		if channelErr != nil {
			apiErr = channelErr
			break
		}

		appendAsyncImageUsedChannel(c, channel.Id)
		usage, apiErr = ExecuteImage(c, relayInfo)
		if apiErr == nil {
			relayInfo.LastError = nil
			return usage, nil
		}

		apiErr = service.NormalizeViolationFeeError(apiErr)
		relayInfo.LastError = apiErr
		logAsyncImageChannelError(c, channel, apiErr)
		if !service.ShouldRetryRelay(c, apiErr, common.RetryTimes-retryParam.GetRetry()) {
			break
		}
	}
	return usage, apiErr
}

func selectAsyncImageChannel(c *gin.Context, relayInfo *relaycommon.RelayInfo, retryParam *service.RetryParam, initialChannel *model.Channel) (*model.Channel, *relaytypes.NewAPIError) {
	channel := initialChannel
	if retryParam.GetRetry() > 0 || channel == nil {
		if _, specificChannel := c.Get("specific_channel_id"); specificChannel {
			return nil, relaytypes.NewError(fmt.Errorf("specified channel is unavailable"), relaytypes.ErrorCodeGetChannelFailed, relaytypes.ErrOptionWithSkipRetry())
		}
		if service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
			return nil, relaytypes.NewError(fmt.Errorf("affinity channel is unavailable and retry is disabled"), relaytypes.ErrorCodeGetChannelFailed, relaytypes.ErrOptionWithSkipRetry())
		}
		var selectGroup string
		var err error
		channel, selectGroup, err = service.CacheGetRandomSatisfiedChannel(retryParam)
		if err != nil {
			return nil, relaytypes.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, relayInfo.OriginModelName, err.Error()), relaytypes.ErrorCodeGetChannelFailed, relaytypes.ErrOptionWithSkipRetry())
		}
		if channel == nil {
			return nil, relaytypes.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在（retry）", selectGroup, relayInfo.OriginModelName), relaytypes.ErrorCodeGetChannelFailed, relaytypes.ErrOptionWithSkipRetry())
		}
		relayInfo.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, relayInfo)
	}

	if apiErr := middleware.SetupContextForSelectedChannel(c, channel, relayInfo.OriginModelName); apiErr != nil {
		return nil, apiErr
	}
	if err := service.RefreshTieredBillingForSelectedGroup(relayInfo); err != nil {
		return nil, relaytypes.NewErrorWithStatusCode(err, relaytypes.ErrorCodeModelPriceError, http.StatusBadRequest, relaytypes.ErrOptionWithSkipRetry())
	}
	return channel, nil
}

func appendAsyncImageUsedChannel(c *gin.Context, channelID int) {
	usedChannels := c.GetStringSlice("use_channel")
	c.Set("use_channel", append(usedChannels, strconv.Itoa(channelID)))
}

func logAsyncImageChannelError(c *gin.Context, channel *model.Channel, apiErr *relaytypes.NewAPIError) {
	if channel == nil || apiErr == nil {
		return
	}
	logger.LogError(c, fmt.Sprintf("channel error (channel #%d, status code: %d): %s", channel.Id, apiErr.StatusCode, common.LocalLogPreview(apiErr.Error())))
	if service.ShouldDisableChannel(apiErr) && channel.GetAutoBan() {
		channelError := *relaytypes.NewChannelError(
			channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey,
			common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan(),
		)
		gopool.Go(func() {
			service.DisableChannel(channelError, apiErr.ErrorWithStatusCode())
		})
	}
}

func restoreAsyncImagePrice(snapshot *model.AsyncImagePriceSnapshot) types.PriceData {
	if snapshot == nil {
		return types.PriceData{}
	}
	priceData := types.PriceData{
		ModelPrice: snapshot.ModelPrice, ModelRatio: snapshot.ModelRatio,
		CompletionRatio: snapshot.CompletionRatio, CacheRatio: snapshot.CacheRatio,
		CacheCreationRatio: snapshot.CacheCreationRatio, CacheCreation5mRatio: snapshot.CacheCreation5mRatio,
		CacheCreation1hRatio: snapshot.CacheCreation1hRatio, ImageRatio: snapshot.ImageRatio,
		AudioRatio: snapshot.AudioRatio, AudioCompletionRatio: snapshot.AudioCompletionRatio,
		UsePrice:       snapshot.UsePrice,
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: snapshot.GroupRatio, GroupSpecialRatio: snapshot.GroupSpecialRatio, HasSpecialRatio: snapshot.HasSpecialRatio},
	}
	for key, ratio := range snapshot.OtherRatios {
		priceData.AddOtherRatio(key, ratio)
	}
	return priceData
}

func asyncImageUpstreamTimeout() time.Duration {
	seconds := operation_setting.GetAsyncImageSetting().UpstreamTimeoutSeconds
	return time.Duration(seconds) * time.Second
}

func asyncImageRetentionDuration() time.Duration {
	hours := operation_setting.GetAsyncImageSetting().TaskRetentionHours
	return time.Duration(hours) * time.Hour
}

func runAsyncImageCleanup() {
	ticker := time.NewTicker(asyncImageCleanupInterval)
	defer ticker.Stop()
	for range ticker.C {
		for {
			deleted, err := model.DeleteExpiredAsyncImageTasks(time.Now().Unix(), asyncImageCleanupBatch)
			if err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("cleanup async image tasks failed: %v", err))
				break
			}
			if deleted < asyncImageCleanupBatch {
				break
			}
		}
	}
}
