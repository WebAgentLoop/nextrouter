package agent_setting

import (
	"math"
	"strings"

	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	DefaultModel         = "gpt-4o"
	DefaultGroup         = "default"
	DefaultMaxIterations = 10
	MaxIterationsLimit   = 50
	MaxSystemPromptRunes = 32768
)

type AgentSetting struct {
	SystemPrompt  string   `json:"system_prompt"`
	DefaultModel  string   `json:"default_model"`
	DefaultGroup  string   `json:"default_group"`
	Temperature   *float64 `json:"temperature"`
	MaxTokens     *uint    `json:"max_tokens"`
	MaxIterations int      `json:"max_iterations"`
}

var agentSetting = AgentSetting{
	DefaultModel:  DefaultModel,
	DefaultGroup:  DefaultGroup,
	MaxIterations: DefaultMaxIterations,
}

func init() {
	config.GlobalConfig.Register("agent_setting", &agentSetting)
}

func GetAgentSetting() AgentSetting {
	result := agentSetting
	result.DefaultModel = strings.TrimSpace(result.DefaultModel)
	result.DefaultGroup = strings.TrimSpace(result.DefaultGroup)

	if result.Temperature != nil && (math.IsNaN(*result.Temperature) || math.IsInf(*result.Temperature, 0) || *result.Temperature < 0 || *result.Temperature > 2) {
		result.Temperature = nil
	}
	if result.MaxTokens != nil && (*result.MaxTokens == 0 || *result.MaxTokens > helper.MaxTokensLimit) {
		result.MaxTokens = nil
	}
	if result.MaxIterations < 1 || result.MaxIterations > MaxIterationsLimit {
		result.MaxIterations = DefaultMaxIterations
	}
	return result
}
