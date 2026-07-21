package agent_setting

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/stretchr/testify/assert"
)

func TestGetAgentSettingNormalizesInvalidRuntimeValues(t *testing.T) {
	original := agentSetting
	t.Cleanup(func() { agentSetting = original })

	invalidTemperature := math.Inf(1)
	invalidMaxTokens := uint(helper.MaxTokensLimit) + 1
	agentSetting = AgentSetting{
		DefaultModel:  "  gpt-test  ",
		DefaultGroup:  "  default  ",
		Temperature:   &invalidTemperature,
		MaxTokens:     &invalidMaxTokens,
		MaxIterations: MaxIterationsLimit + 1,
	}

	result := GetAgentSetting()

	assert.Equal(t, "gpt-test", result.DefaultModel)
	assert.Equal(t, "default", result.DefaultGroup)
	assert.Nil(t, result.Temperature)
	assert.Nil(t, result.MaxTokens)
	assert.Equal(t, DefaultMaxIterations, result.MaxIterations)
}

func TestGetAgentSettingPreservesExplicitZeroTemperature(t *testing.T) {
	original := agentSetting
	t.Cleanup(func() { agentSetting = original })

	zero := 0.0
	agentSetting.Temperature = &zero

	result := GetAgentSetting()

	if assert.NotNil(t, result.Temperature) {
		assert.Zero(t, *result.Temperature)
	}
}
