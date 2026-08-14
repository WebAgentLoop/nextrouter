package agnesai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	videoEndpoint       = "/v1/videos"
	videoStatusEndpoint = "/agnesapi"
	maxNumFrames        = 441
)

var modelList = []string{"agnes-video-v2.0"}

type videoRequest struct {
	Model          string          `json:"model"`
	Prompt         string          `json:"prompt"`
	Image          string          `json:"image,omitempty"`
	Width          *int            `json:"width,omitempty"`
	Height         *int            `json:"height,omitempty"`
	NumFrames      *int            `json:"num_frames,omitempty"`
	FrameRate      *float64        `json:"frame_rate,omitempty"`
	NegativePrompt string          `json:"negative_prompt,omitempty"`
	ExtraBody      json.RawMessage `json:"extra_body,omitempty"`
}

type videoResponse struct {
	ID          string `json:"id,omitempty"`
	TaskID      string `json:"task_id,omitempty"`
	VideoID     string `json:"video_id,omitempty"`
	Object      string `json:"object,omitempty"`
	Model       string `json:"model,omitempty"`
	Status      string `json:"status,omitempty"`
	Progress    int    `json:"progress,omitempty"`
	CreatedAt   int64  `json:"created_at,omitempty"`
	CompletedAt int64  `json:"completed_at,omitempty"`
	Seconds     string `json:"seconds,omitempty"`
	Size        string `json:"size,omitempty"`
	Metadata    struct {
		URL string `json:"url,omitempty"`
	} `json:"metadata,omitempty"`
	Error *struct {
		Message string `json:"message,omitempty"`
		Code    string `json:"code,omitempty"`
	} `json:"error,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func taskError(message, code string) *taskdto.TaskError {
	return service.TaskErrorWrapperLocal(fmt.Errorf("%s", message), code, http.StatusBadRequest)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	var req videoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Model) == "" {
		return taskError("model is required", "missing_model")
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return taskError("prompt is required", "invalid_request")
	}
	if req.Width != nil && *req.Width <= 0 {
		return taskError("width must be greater than zero", "invalid_width")
	}
	if req.Height != nil && *req.Height <= 0 {
		return taskError("height must be greater than zero", "invalid_height")
	}
	// AgnesAI documents these values as optional, but does not document their
	// defaults. The gateway requires explicit values so it can pre-charge the
	// actual duration instead of guessing a billable multiplier.
	if req.NumFrames == nil || req.FrameRate == nil {
		return taskError("num_frames and frame_rate are required for AgnesAI video billing", "invalid_duration")
	}
	if *req.NumFrames <= 0 || *req.NumFrames > maxNumFrames || (*req.NumFrames-1)%8 != 0 {
		return taskError("num_frames must be an 8n+1 value between 1 and 441", "invalid_num_frames")
	}
	if *req.FrameRate <= 0 || *req.FrameRate > 60 || math.IsNaN(*req.FrameRate) || math.IsInf(*req.FrameRate, 0) {
		return taskError("frame_rate must be between 1 and 60", "invalid_frame_rate")
	}
	duration := float64(*req.NumFrames) / *req.FrameRate
	if duration <= 0 || duration > relaycommon.MaxTaskDurationSeconds || math.IsNaN(duration) || math.IsInf(duration, 0) {
		return taskError(fmt.Sprintf("video duration must be between 1 and %d seconds", relaycommon.MaxTaskDurationSeconds), "invalid_duration")
	}

	action := constant.TaskActionTextGenerate
	if strings.TrimSpace(req.Image) != "" {
		action = constant.TaskActionGenerate
	}
	if len(req.ExtraBody) > 0 {
		var extraBody struct {
			Image []string `json:"image"`
		}
		if err := common.Unmarshal(req.ExtraBody, &extraBody); err == nil && len(extraBody.Image) > 0 {
			action = constant.TaskActionGenerate
		}
	}
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	info.Action = action
	c.Set("task_request", relaycommon.TaskSubmitReq{Model: req.Model, Prompt: req.Prompt, Image: req.Image})
	c.Set("agnes_video_request", req)
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	v, ok := c.Get("agnes_video_request")
	if !ok {
		return nil
	}
	req, ok := v.(videoRequest)
	if !ok || req.NumFrames == nil || req.FrameRate == nil {
		return nil
	}
	return map[string]float64{"seconds": float64(*req.NumFrames) / *req.FrameRate}
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(a.baseURL, "/") + videoEndpoint, nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	body, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	payload["model"] = info.UpstreamModelName
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var upstream videoResponse
	if err := common.Unmarshal(body, &upstream); err != nil {
		return "", nil, service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
	}
	upstreamID := upstream.VideoID
	if upstreamID == "" {
		upstreamID = upstream.TaskID
	}
	if upstreamID == "" {
		upstreamID = upstream.ID
	}
	if upstreamID == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("AgnesAI response has no video_id"), "invalid_response", http.StatusInternalServerError)
	}

	result := dto.NewOpenAIVideo()
	result.ID = info.PublicTaskID
	result.TaskID = info.PublicTaskID
	result.Model = info.OriginModelName
	result.CreatedAt = upstream.CreatedAt
	if result.CreatedAt == 0 {
		result.CreatedAt = time.Now().Unix()
	}
	result.SetProgressStr(strconv.Itoa(upstream.Progress))
	c.JSON(http.StatusOK, result)
	return upstreamID, body, nil
}

func (a *TaskAdaptor) GetModelList() []string { return modelList }

func (a *TaskAdaptor) GetChannelName() string { return "agnesai" }

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	videoID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(videoID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	endpoint, err := url.Parse(strings.TrimRight(baseURL, "/") + videoStatusEndpoint)
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("video_id", videoID)
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var upstream videoResponse
	if err := common.Unmarshal(respBody, &upstream); err != nil {
		return nil, err
	}
	result := &relaycommon.TaskInfo{TaskID: upstream.VideoID}
	if result.TaskID == "" {
		result.TaskID = upstream.TaskID
	}
	switch upstream.Status {
	case "queued", "pending":
		result.Status = model.TaskStatusQueued
	case "in_progress", "processing":
		result.Status = model.TaskStatusInProgress
	case "completed":
		result.Status = model.TaskStatusSuccess
		result.Url = upstream.Metadata.URL
	case "failed", "cancelled":
		result.Status = model.TaskStatusFailure
		if upstream.Error != nil {
			result.Reason = upstream.Error.Message
		}
		if result.Reason == "" {
			result.Reason = "AgnesAI video task failed"
		}
	default:
		return nil, fmt.Errorf("unknown AgnesAI task status: %s", upstream.Status)
	}
	if upstream.Progress > 0 {
		result.Progress = strconv.Itoa(upstream.Progress) + "%"
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := task.ToOpenAIVideo()
	var upstream videoResponse
	if err := common.Unmarshal(task.Data, &upstream); err != nil {
		return nil, err
	}
	if upstream.CreatedAt != 0 {
		video.CreatedAt = upstream.CreatedAt
	}
	if upstream.CompletedAt != 0 {
		video.CompletedAt = upstream.CompletedAt
	}
	video.Seconds = upstream.Seconds
	video.Size = upstream.Size
	if upstream.Error != nil {
		video.Error = &dto.OpenAIVideoError{Message: upstream.Error.Message, Code: upstream.Error.Code}
	}
	return common.Marshal(video)
}
