package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelectAsyncImageChannelDoesNotReplaceUnavailableConstrainedChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name  string
		setup func(*gin.Context)
		want  string
	}{
		{
			name: "specific channel",
			setup: func(c *gin.Context) {
				c.Set("specific_channel_id", "42")
			},
			want: "specified channel is unavailable",
		},
		{
			name: "affinity retry disabled",
			setup: func(c *gin.Context) {
				service.RestoreChannelAffinitySkipRetry(c, true)
			},
			want: "affinity channel is unavailable and retry is disabled",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			tt.setup(c)
			retry := &service.RetryParam{Ctx: c, Retry: common.GetPointer(0)}

			channel, apiErr := selectAsyncImageChannel(c, &relaycommon.RelayInfo{}, retry, nil)

			assert.Nil(t, channel)
			require.NotNil(t, apiErr)
			assert.Contains(t, apiErr.Error(), tt.want)
		})
	}
}

func TestSelectAsyncImageChannelRateLimitedPinnedInitialChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("specific_channel_id", "42")
	retry := &service.RetryParam{Ctx: c, Retry: common.GetPointer(0)}

	channel := &model.Channel{
		Id:     42,
		Type:   constant.ChannelTypeOpenAI,
		Key:    "sk-async-rate-limit-test",
		Status: common.ChannelStatusEnabled,
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{RateLimit: &dto.ChannelRateLimit{Enabled: true, Requests: 1, WindowSeconds: 60}})
	require.True(t, service.AllowChannelRequest(channel), "drain the only token so the pinned channel is throttled")

	picked, apiErr := selectAsyncImageChannel(c, &relaycommon.RelayInfo{}, retry, channel)

	assert.Nil(t, picked)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
	require.NotNil(t, apiErr.Err)
	assert.ErrorIs(t, apiErr.Err, service.ErrChannelRateLimited)
}
