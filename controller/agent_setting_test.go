package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/agent_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAgentSettingReturnsDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	GetAgentSetting(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool                       `json:"success"`
		Data    agent_setting.AgentSetting `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, agent_setting.DefaultModel, response.Data.DefaultModel)
	assert.Equal(t, agent_setting.DefaultGroup, response.Data.DefaultGroup)
	assert.Nil(t, response.Data.Temperature)
	assert.Nil(t, response.Data.MaxTokens)
	assert.Equal(t, agent_setting.DefaultMaxIterations, response.Data.MaxIterations)
}

func TestUpdateOptionRejectsInvalidAgentScalarValues(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name string
		body string
	}{
		{name: "null system prompt", body: `{"key":"agent_setting.system_prompt","value":null}`},
		{name: "temperature above limit", body: `{"key":"agent_setting.temperature","value":2.1}`},
		{name: "zero max tokens", body: `{"key":"agent_setting.max_tokens","value":0}`},
		{name: "max tokens above relay limit", body: `{"key":"agent_setting.max_tokens","value":1073741824}`},
		{name: "zero iterations", body: `{"key":"agent_setting.max_iterations","value":0}`},
		{name: "iterations above limit", body: `{"key":"agent_setting.max_iterations","value":51}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(tt.body))

			UpdateOption(ctx)

			var response struct {
				Success bool `json:"success"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
		})
	}
}
