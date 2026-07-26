package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetAsyncImageSettingNormalizesOutOfRangePersistedValues(t *testing.T) {
	original := asyncImageSetting
	t.Cleanup(func() { asyncImageSetting = original })
	asyncImageSetting = AsyncImageSetting{
		MaxPendingPerUser:      MaxAsyncImageMaxPendingPerUser + 1,
		UpstreamTimeoutSeconds: MinAsyncImageUpstreamTimeout - 1,
		TaskRetentionHours:     MaxAsyncImageTaskRetention + 1,
	}

	actual := GetAsyncImageSetting()

	assert.Equal(t, DefaultAsyncImageMaxPendingPerUser, actual.MaxPendingPerUser)
	assert.Equal(t, DefaultAsyncImageUpstreamTimeout, actual.UpstreamTimeoutSeconds)
	assert.Equal(t, DefaultAsyncImageTaskRetention, actual.TaskRetentionHours)
}

func TestGetAsyncImageSettingPreservesValidValues(t *testing.T) {
	original := asyncImageSetting
	t.Cleanup(func() { asyncImageSetting = original })
	asyncImageSetting = AsyncImageSetting{
		MaxPendingPerUser:      50,
		UpstreamTimeoutSeconds: 900,
		TaskRetentionHours:     48,
	}

	assert.Equal(t, asyncImageSetting, GetAsyncImageSetting())
}
