package agnesai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newVideoContext(body string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func TestValidateRequestAndEstimateBilling(t *testing.T) {
	c := newVideoContext(`{"model":"agnes-video-v2.0","prompt":"a mountain","num_frames":121,"frame_rate":24}`)
	info := &relaycommon.RelayInfo{}
	adaptor := &TaskAdaptor{}

	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	assert.Equal(t, constant.TaskActionTextGenerate, info.Action)
	assert.Equal(t, map[string]float64{"seconds": 121.0 / 24.0}, adaptor.EstimateBilling(c, info))
}

func TestValidateRequestRejectsInvalidFrameConfiguration(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "missing frame rate",
			body: `{"model":"agnes-video-v2.0","prompt":"a mountain","num_frames":121}`,
		},
		{
			name: "not 8n plus 1",
			body: `{"model":"agnes-video-v2.0","prompt":"a mountain","num_frames":120,"frame_rate":24}`,
		},
		{
			name: "frame rate too high",
			body: `{"model":"agnes-video-v2.0","prompt":"a mountain","num_frames":121,"frame_rate":61}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(newVideoContext(tt.body), &relaycommon.RelayInfo{})
			require.NotNil(t, taskErr)
			assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
		})
	}
}

func TestBuildRequestBodyMapsModelAndPreservesProviderFields(t *testing.T) {
	c := newVideoContext(`{"model":"agnes-video-v2.0","prompt":"a mountain","num_frames":121,"frame_rate":24,"extra_body":{"mode":"keyframes","image":["https://example.com/a.png"]}}`)
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, &relaycommon.RelayInfo{}))
	body, err := adaptor.BuildRequestBody(c, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "mapped-video"},
	})
	require.NoError(t, err)
	data, err := io.ReadAll(body)
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(data, &payload))
	assert.Equal(t, "mapped-video", payload["model"])
	assert.Equal(t, map[string]any{
		"mode":  "keyframes",
		"image": []any{"https://example.com/a.png"},
	}, payload["extra_body"])
}

func TestParseTaskResultUsesAgnesVideoURL(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"video_id":"vid_123","status":"completed","progress":100,"metadata":{"url":"https://cdn.agnes-ai.com/video.mp4"}}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, result.Status)
	assert.Equal(t, "vid_123", result.TaskID)
	assert.Equal(t, "https://cdn.agnes-ai.com/video.mp4", result.Url)
	assert.Equal(t, "100%", result.Progress)
}

func TestFetchTaskUsesAgnesVideoIDEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/agnesapi", r.URL.Path)
		assert.Equal(t, "vid_123", r.URL.Query().Get("video_id"))
		assert.Equal(t, "Bearer agnes-key", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"video_id":"vid_123","status":"queued"}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "agnes-key", map[string]any{"task_id": "vid_123"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
