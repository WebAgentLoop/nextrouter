package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const (
	DefaultAsyncImageMaxPendingPerUser = 20
	DefaultAsyncImageUpstreamTimeout   = 600
	DefaultAsyncImageTaskRetention     = 24

	MinAsyncImageMaxPendingPerUser = 1
	MaxAsyncImageMaxPendingPerUser = 1000
	MinAsyncImageUpstreamTimeout   = 1
	MaxAsyncImageUpstreamTimeout   = 3600
	MinAsyncImageTaskRetention     = 1
	MaxAsyncImageTaskRetention     = 720
)

type AsyncImageSetting struct {
	MaxPendingPerUser      int `json:"max_pending_per_user"`
	UpstreamTimeoutSeconds int `json:"upstream_timeout_seconds"`
	TaskRetentionHours     int `json:"task_retention_hours"`
}

var asyncImageSetting = AsyncImageSetting{
	MaxPendingPerUser:      DefaultAsyncImageMaxPendingPerUser,
	UpstreamTimeoutSeconds: DefaultAsyncImageUpstreamTimeout,
	TaskRetentionHours:     DefaultAsyncImageTaskRetention,
}

func init() {
	config.GlobalConfig.Register("async_image_setting", &asyncImageSetting)
}

func GetAsyncImageSetting() AsyncImageSetting {
	setting := asyncImageSetting
	if setting.MaxPendingPerUser < MinAsyncImageMaxPendingPerUser || setting.MaxPendingPerUser > MaxAsyncImageMaxPendingPerUser {
		setting.MaxPendingPerUser = DefaultAsyncImageMaxPendingPerUser
	}
	if setting.UpstreamTimeoutSeconds < MinAsyncImageUpstreamTimeout || setting.UpstreamTimeoutSeconds > MaxAsyncImageUpstreamTimeout {
		setting.UpstreamTimeoutSeconds = DefaultAsyncImageUpstreamTimeout
	}
	if setting.TaskRetentionHours < MinAsyncImageTaskRetention || setting.TaskRetentionHours > MaxAsyncImageTaskRetention {
		setting.TaskRetentionHours = DefaultAsyncImageTaskRetention
	}
	return setting
}
