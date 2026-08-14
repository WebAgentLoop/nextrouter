package agnesai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIRequestEnablesAgnesThinking(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{}
	request := &dto.GeneralOpenAIRequest{
		Model:           "agnes-2.5-pro",
		ReasoningEffort: "high",
		StreamOptions:   &dto.StreamOptions{IncludeUsage: true},
	}

	converted, err := adaptor.ConvertOpenAIRequest(nil, info, request)
	require.NoError(t, err)
	require.Same(t, request, converted)
	assert.Nil(t, request.StreamOptions)
	assert.Empty(t, request.ReasoningEffort)
	assert.JSONEq(t, `{"enable_thinking":true}`, string(request.ChatTemplateKwargs))
}

func TestConvertImageRequestPreservesAgnesExtraBody(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", http.NoBody)
	c.Request.Header.Set("Content-Type", "application/json")
	body := []byte(`{"model":"agnes-image-2.1-flash","prompt":"a cat","ratio":"16:9","extra_body":{"image":["https://example.com/ref.png"],"response_format":"url"},"return_base64":false}`)
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	c.Request.ContentLength = int64(len(body))

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "mapped-agnes-image",
		},
	}, dto.ImageRequest{})
	require.NoError(t, err)

	data, err := common.Marshal(converted)
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(data, &payload))
	assert.Equal(t, "mapped-agnes-image", payload["model"])
	assert.Equal(t, "16:9", payload["ratio"])
	assert.Equal(t, false, payload["return_base64"])
	require.Equal(t, map[string]any{
		"image":           []any{"https://example.com/ref.png"},
		"response_format": "url",
	}, payload["extra_body"])
}

func TestConvertImageRequestUsesStructuredChannelTestRequest(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/test/1", http.NoBody)

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
		RelayMode:     relayconstant.RelayModeImagesGenerations,
		IsChannelTest: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "mapped-agnes-image",
		},
	}, dto.ImageRequest{
		Model:  "agnes-image-2.1-flash",
		Prompt: "a cute cat",
		Size:   "1024x1024",
	})
	require.NoError(t, err)

	request, ok := converted.(dto.ImageRequest)
	require.True(t, ok)
	assert.Equal(t, "mapped-agnes-image", request.Model)
	assert.Equal(t, "a cute cat", request.Prompt)
	assert.Equal(t, "1024x1024", request.Size)
}

func TestSetupRequestHeaderForClaude(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	header := http.Header{}
	err := (&Adaptor{}).SetupRequestHeader(c, &header, &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "agnes-key"},
	})
	require.NoError(t, err)
	assert.Equal(t, "Bearer agnes-key", header.Get("Authorization"))
	assert.Equal(t, "agnes-key", header.Get("x-api-key"))
	assert.Equal(t, "2023-06-01", header.Get("anthropic-version"))
}
