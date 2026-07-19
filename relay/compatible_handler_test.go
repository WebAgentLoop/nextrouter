package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestApplyForceStream guards the invariant that ForceStream only activates
// when the channel opts in, the client requested non-streaming, the converted
// upstream protocol is Chat Completions, and neither pass-through mode is
// active. When activated it must flip stream to true and set ForceStreamBuffer.
func TestApplyForceStream(t *testing.T) {
	// ApplyForceStream reads the global pass-through flag, so save and restore it.
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	t.Cleanup(func() { model_setting.GetGlobalSettings().PassThroughRequestEnabled = original })

	ptrBool := func(v bool) *bool { return &v }

	tests := []struct {
		name              string
		forceStream       bool
		passThroughBody   bool
		globalPassThrough bool
		clientStream      bool
		convertedRequest  any
		wantActive        bool
	}{
		{name: "active for converted chat upstream", forceStream: true, convertedRequest: &dto.GeneralOpenAIRequest{Stream: ptrBool(false)}, wantActive: true},
		{name: "active regardless of converted stream default", forceStream: true, convertedRequest: &dto.GeneralOpenAIRequest{Stream: ptrBool(true)}, wantActive: true},
		{name: "inactive when client already streaming", forceStream: true, clientStream: true, convertedRequest: &dto.GeneralOpenAIRequest{Stream: ptrBool(true)}},
		{name: "inactive for responses upstream", forceStream: true, convertedRequest: &dto.OpenAIResponsesRequest{Stream: ptrBool(false)}},
		{name: "inactive for claude upstream", forceStream: true, convertedRequest: &dto.ClaudeRequest{Stream: ptrBool(false)}},
		{name: "inactive when force stream disabled", convertedRequest: &dto.GeneralOpenAIRequest{Stream: ptrBool(false)}},
		{name: "inactive when channel pass-through enabled", forceStream: true, passThroughBody: true, convertedRequest: &dto.GeneralOpenAIRequest{Stream: ptrBool(false)}},
		{name: "inactive when global pass-through enabled", forceStream: true, globalPassThrough: true, convertedRequest: &dto.GeneralOpenAIRequest{Stream: ptrBool(false)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model_setting.GetGlobalSettings().PassThroughRequestEnabled = tt.globalPassThrough

			info := &relaycommon.RelayInfo{
				IsStream: tt.clientStream,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelSetting: dto.ChannelSettings{
						ForceStream:            tt.forceStream,
						PassThroughBodyEnabled: tt.passThroughBody,
					},
				},
			}

			ApplyForceStream(info, tt.convertedRequest)

			require.Equal(t, tt.wantActive, info.ForceStreamBuffer)
			if req, ok := tt.convertedRequest.(*dto.GeneralOpenAIRequest); ok && tt.wantActive {
				require.NotNil(t, req.Stream)
				assert.True(t, *req.Stream, "stream must be forced true when active")
			}
		})
	}
}

// TestApplyForceStream_ClearsStaleFlagOnRetry guards the retry-reuse invariant:
// RelayInfo is reused across retries onto different channels. If the first
// channel forced a Chat stream and then failed, retrying onto a non-Chat
// upstream must clear the flag. Otherwise that upstream response would be
// routed into the Chat SSE accumulator.
func TestApplyForceStream_ClearsStaleFlagOnRetry(t *testing.T) {
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	t.Cleanup(func() { model_setting.GetGlobalSettings().PassThroughRequestEnabled = original })

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{ForceStream: true},
		},
	}

	// First attempt: ForceStream channel activates buffering.
	firstReq := &dto.GeneralOpenAIRequest{}
	ApplyForceStream(info, firstReq)
	require.True(t, info.ForceStreamBuffer, "first attempt on ForceStream channel must activate")
	require.NotNil(t, firstReq.Stream)
	require.True(t, *firstReq.Stream)

	// Simulate a retry onto a Responses upstream while keeping ForceStream
	// enabled on the selected channel.
	secondReq := &dto.OpenAIResponsesRequest{}
	ApplyForceStream(info, secondReq)

	assert.False(t, info.ForceStreamBuffer, "stale buffering flag must be cleared on retry to a non-Chat upstream")
	assert.Nil(t, secondReq.Stream, "non-forced request stream must remain untouched")
}
