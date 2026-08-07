package service

import (
	"context"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newRateLimitedChannel(t *testing.T, id int, rl *dto.ChannelRateLimit) *model.Channel {
	t.Helper()
	channel := &model.Channel{
		Id:     id,
		Name:   fmt.Sprintf("rate-limit-channel-%d", id),
		Type:   constant.ChannelTypeOpenAI,
		Key:    "sk-rate-limit-test",
		Status: common.ChannelStatusEnabled,
	}
	if rl != nil {
		channel.SetOtherSettings(dto.ChannelOtherSettings{RateLimit: rl})
	}
	return channel
}

func useChannelRateLimitMiniRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	previousRedisEnabled := common.RedisEnabled
	previousRedisClient := common.RDB
	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())

	common.RedisEnabled = true
	common.RDB = redisClient
	t.Cleanup(func() {
		_ = redisClient.Close()
		common.RedisEnabled = previousRedisEnabled
		common.RDB = previousRedisClient
	})

	return redisServer, redisClient
}

func TestAllowChannelRequestUnsetOrDisabled(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	assert.True(t, AllowChannelRequest(nil), "a nil channel has no limit")
	assert.True(t, AllowChannelRequest(newRateLimitedChannel(t, 4001, nil)))
	assert.True(t, AllowChannelRequest(newRateLimitedChannel(t, 4002, &dto.ChannelRateLimit{})))
	assert.True(t, AllowChannelRequest(newRateLimitedChannel(t, 4003, &dto.ChannelRateLimit{Enabled: true})))
	assert.True(t, AllowChannelRequest(newRateLimitedChannel(t, 4004, &dto.ChannelRateLimit{Enabled: false, Requests: 10, WindowSeconds: 1})))
}

func TestAllowChannelRequestInMemorySlidingWindow(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	channel := newRateLimitedChannel(t, 4010, &dto.ChannelRateLimit{Enabled: true, Requests: 3, WindowSeconds: 60})

	assert.True(t, AllowChannelRequest(channel))
	assert.True(t, AllowChannelRequest(channel))
	assert.True(t, AllowChannelRequest(channel))
	// The fourth request within the window must be denied.
	assert.False(t, AllowChannelRequest(channel))
}

func TestAllowChannelRequestRedisSlidingWindow(t *testing.T) {
	_, redisClient := useChannelRateLimitMiniRedis(t)
	channel := newRateLimitedChannel(t, 4011, &dto.ChannelRateLimit{Enabled: true, Requests: 2, WindowSeconds: 60})

	assert.True(t, AllowChannelRequest(channel))
	assert.True(t, AllowChannelRequest(channel))
	assert.False(t, AllowChannelRequest(channel), "at most two requests per window")

	key := fmt.Sprintf("%s:%d", channelRateLimitNamespace, channel.Id)
	count, err := redisClient.ZCard(context.Background(), key).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(2), count, "both admissions are kept in the sorted set")
	ttl, err := redisClient.TTL(context.Background(), key).Result()
	require.NoError(t, err)
	assert.LessOrEqual(t, time.Duration(60)*time.Second, ttl)
}

func TestAllowChannelRequestRedisFailureFailsOpen(t *testing.T) {
	_, redisClient := useChannelRateLimitMiniRedis(t)
	channel := newRateLimitedChannel(t, 4012, &dto.ChannelRateLimit{Enabled: true, Requests: 1, WindowSeconds: 60})

	// Singleton limiter already bound to this client; close the client so the
	// token-bucket call errors and the check must fail open.
	require.NoError(t, redisClient.Close())
	assert.True(t, AllowChannelRequest(channel), "an unavailable Redis must not block traffic")
}

func createChannelSelectRateLimitChannel(t *testing.T, db *gorm.DB, id int, modelName string, priority int64, rl *dto.ChannelRateLimit) {
	t.Helper()
	weight := uint(100)
	channel := &model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   modelName,
		Group:    "default",
		Priority: &priority,
	}
	if rl != nil {
		channel.SetOtherSettings(dto.ChannelOtherSettings{RateLimit: rl})
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     modelName,
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func newChannelRateLimitRetryParam(modelName string) *RetryParam {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	retry := 0
	return &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}
}

func TestCacheGetRandomSatisfiedChannelSkipsRateLimitedChannel(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "channel-rate-limit-skip-model"
	createChannelSelectRateLimitChannel(t, db, 4101, modelName, 100,
		&dto.ChannelRateLimit{Enabled: true, Requests: 1, WindowSeconds: 60})
	createChannelSelectRateLimitChannel(t, db, 4102, modelName, 50, nil)
	model.InitChannelCache()

	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	// Drain the single token of the high-priority channel so the selector must
	// skip it and fall back to the next priority tier.
	limited, err := model.CacheGetChannel(4101)
	require.NoError(t, err)
	assert.True(t, AllowChannelRequest(limited))

	param := newChannelRateLimitRetryParam(modelName)
	channel, selectGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 4102, channel.Id, "the rate-limited channel must be skipped")
	assert.Equal(t, "default", selectGroup)
}

func TestCacheGetRandomSatisfiedChannelAllCandidatesRateLimited(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "channel-rate-limit-all-limited-model"
	createChannelSelectRateLimitChannel(t, db, 4103, modelName, 100,
		&dto.ChannelRateLimit{Enabled: true, Requests: 1, WindowSeconds: 60})
	model.InitChannelCache()

	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	limited, err := model.CacheGetChannel(4103)
	require.NoError(t, err)
	assert.True(t, AllowChannelRequest(limited))

	param := newChannelRateLimitRetryParam(modelName)
	channel, _, err := CacheGetRandomSatisfiedChannel(param)
	require.ErrorIs(t, err, ErrChannelRateLimited)
	assert.Nil(t, channel)
}

func createChannelSelectAutoGroupsRateLimitedChannel(t *testing.T, db *gorm.DB, id int, group, modelName string, rl *dto.ChannelRateLimit) {
	t.Helper()
	priority := int64(0)
	weight := uint(100)
	channel := &model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}
	if rl != nil {
		channel.SetOtherSettings(dto.ChannelOtherSettings{RateLimit: rl})
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func TestCacheGetRandomSatisfiedChannelAutoFallsThroughRateLimitedGroup(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "auto-rate-limit-fallback-model"
	createChannelSelectAutoGroupsRateLimitedChannel(t, db, 4201, "vip", modelName,
		&dto.ChannelRateLimit{Enabled: true, Requests: 1, WindowSeconds: 60})
	createChannelSelectAutoGroupsRateLimitedChannel(t, db, 4202, "default", modelName, nil)
	model.InitChannelCache()

	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})

	// Drain the vip channel's single token so the whole first group is throttled.
	limited, err := model.CacheGetChannel(4201)
	require.NoError(t, err)
	require.True(t, AllowChannelRequest(limited))

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	channel, selectGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 4202, channel.Id, "a fully rate-limited auto group must fall through to the next healthy group")
	assert.Equal(t, "default", selectGroup)
}

func TestCacheGetRandomSatisfiedChannelPicksRateLimitedChannelWhenTokenAvailable(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "channel-rate-limit-available-model"
	createChannelSelectRateLimitChannel(t, db, 4104, modelName, 100,
		&dto.ChannelRateLimit{Enabled: true, Requests: 5, WindowSeconds: 60})
	createChannelSelectRateLimitChannel(t, db, 4105, modelName, 50, nil)
	model.InitChannelCache()

	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	// The high-priority channel still has tokens: it must be selected normally
	// and the consumption must count against its bucket.
	param := newChannelRateLimitRetryParam(modelName)
	channel, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 4104, channel.Id)

	// The selection consumed one token (total capacity 5): the next four
	// requests still pass, the fifth after that must be denied.
	for range 4 {
		assert.True(t, AllowChannelRequest(channel))
	}
	assert.False(t, AllowChannelRequest(channel))
}
