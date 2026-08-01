package relay

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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
