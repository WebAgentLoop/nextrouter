package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func performModelDocumentationRequest(t *testing.T, method, target string, body any, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()

	var requestBody *bytes.Reader
	if body == nil {
		requestBody = bytes.NewReader(nil)
	} else {
		payload, err := common.Marshal(body)
		require.NoError(t, err)
		requestBody = bytes.NewReader(payload)
	}

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, target, requestBody)
	context.Request.Header.Set("Content-Type", "application/json")
	handler(context)
	return recorder
}

func TestModelDocumentationCreateEnforcesUtf8ByteLimit(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	atLimit := strings.Repeat("a", model.MaxModelDocumentationBytes)
	recorder := performModelDocumentationRequest(t, http.MethodPost, "/api/models/", model.Model{
		ModelName:     "documentation-at-limit",
		Documentation: atLimit,
		Status:        1,
	}, CreateModelMeta)
	require.Equal(t, http.StatusOK, recorder.Code)

	var stored model.Model
	require.NoError(t, db.Where("model_name = ?", "documentation-at-limit").First(&stored).Error)
	assert.Equal(t, atLimit, stored.Documentation)

	models, total, err := model.SearchModels("", "", "", "", 0, 100)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, models, 1)
	assert.Empty(t, models[0].Documentation)
	serializedModels, err := common.Marshal(models)
	require.NoError(t, err)
	assert.NotContains(t, string(serializedModels), `"documentation":`)

	overLimit := strings.Repeat("界", model.MaxModelDocumentationBytes/3+1)
	recorder = performModelDocumentationRequest(t, http.MethodPost, "/api/models/", model.Model{
		ModelName:     "documentation-over-limit",
		Documentation: overLimit,
		Status:        1,
	}, CreateModelMeta)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	var count int64
	require.NoError(t, db.Model(&model.Model{}).Where("model_name = ?", "documentation-over-limit").Count(&count).Error)
	assert.Zero(t, count)
}

func TestModelDocumentationUpdatesWithoutStatusOnlyDataLoss(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	stored := model.Model{
		ModelName:     "documentation-update",
		Description:   "summary",
		Documentation: "# Original",
		Status:        1,
	}
	require.NoError(t, db.Create(&stored).Error)

	recorder := performModelDocumentationRequest(t, http.MethodPut, "/api/models/?status_only=true", model.Model{
		Id:     stored.Id,
		Status: 0,
	}, UpdateModelMeta)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, db.First(&stored, stored.Id).Error)
	assert.Equal(t, "# Original", stored.Documentation)

	recorder = performModelDocumentationRequest(t, http.MethodPut, "/api/models/", model.Model{
		Id:            stored.Id,
		ModelName:     stored.ModelName,
		Description:   stored.Description,
		Documentation: "# Updated\n\n```json\n{}\n```",
		Status:        1,
	}, UpdateModelMeta)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, db.First(&stored, stored.Id).Error)
	assert.Equal(t, "# Updated\n\n```json\n{}\n```", stored.Documentation)

	recorder = performModelDocumentationRequest(t, http.MethodPut, "/api/models/", model.Model{
		Id:            stored.Id,
		ModelName:     stored.ModelName,
		Description:   stored.Description,
		Documentation: strings.Repeat("界", model.MaxModelDocumentationBytes/3+1),
		Status:        1,
	}, UpdateModelMeta)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	require.NoError(t, db.First(&stored, stored.Id).Error)
	assert.Equal(t, "# Updated\n\n```json\n{}\n```", stored.Documentation)
}

func TestGetModelDocumentationHonorsPricingVisibilityAndNameRules(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))

	require.NoError(t, db.Create(&model.Channel{
		Id:     9001,
		Name:   "documentation-channel",
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "family/model-a", ChannelId: 9001, Enabled: true},
		{Group: "private", Model: "hidden-model", ChannelId: 9001, Enabled: true},
		{Group: "default", Model: "disabled-model", ChannelId: 9001, Enabled: true},
	}).Error)
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "family/", Documentation: "# Shared family guide", Status: 1, NameRule: model.NameRulePrefix},
		{ModelName: "hidden-model", Documentation: "# Hidden guide", Status: 1, NameRule: model.NameRuleExact},
		{ModelName: "disabled-model", Documentation: "# Disabled guide", Status: 0, NameRule: model.NameRuleExact},
	}).Error)
	require.NoError(t, db.Model(&model.Model{}).Where("model_name = ?", "disabled-model").Update("status", 0).Error)
	model.InitChannelCache()
	model.InvalidatePricingCache()

	pricingByName := pricingByModelName(model.GetPricing())
	require.Contains(t, pricingByName, "family/model-a")
	assert.True(t, pricingByName["family/model-a"].HasDocumentation)
	serializedPricing, err := common.Marshal(pricingByName["family/model-a"])
	require.NoError(t, err)
	assert.Contains(t, string(serializedPricing), `"has_documentation":true`)
	assert.NotContains(t, string(serializedPricing), "Shared family guide")

	query := url.Values{"model": {"family/model-a"}}
	recorder := performModelDocumentationRequest(t, http.MethodGet, "/api/pricing/documentation?"+query.Encode(), nil, GetModelDocumentation)
	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			ModelName     string `json:"model_name"`
			Documentation string `json:"documentation"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, "family/model-a", response.Data.ModelName)
	assert.Equal(t, "# Shared family guide", response.Data.Documentation)

	for _, modelName := range []string{"hidden-model", "disabled-model", "missing-model"} {
		query = url.Values{"model": {modelName}}
		recorder = performModelDocumentationRequest(t, http.MethodGet, "/api/pricing/documentation?"+query.Encode(), nil, GetModelDocumentation)
		assert.Equal(t, http.StatusNotFound, recorder.Code, modelName)
	}
}
