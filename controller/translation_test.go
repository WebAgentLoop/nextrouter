package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateModelTranslationRejectsChangedSourceVersion(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	source := model.Model{ModelName: "manual-translation-conflict", Description: "Old description", SourceLanguage: "en", Status: 1}
	require.NoError(t, source.Insert())
	require.NoError(t, db.Create(&model.ModelTranslation{
		ModelID: source.Id, Locale: "fr",
		Description: "Existing translation", DescriptionSourceHash: model.ModelContentHash(source.Description), DescriptionStatus: model.TranslationStatusCompleted,
	}).Error)
	oldVersion := model.ModelSourceVersionHash(source.SourceLanguage, source.Description)
	source.Description = "New description"
	require.NoError(t, source.Update())

	outdatedTranslation := "Outdated translation"
	payload, err := common.Marshal(updateModelTranslationRequest{
		Description:              &outdatedTranslation,
		DescriptionSourceVersion: oldVersion,
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Params = gin.Params{
		{Key: "id", Value: strconv.Itoa(source.Id)},
		{Key: "locale", Value: "fr"},
	}
	context.Request = httptest.NewRequest(http.MethodPut, "/api/models/translation", bytes.NewReader(payload))
	context.Request.Header.Set("Content-Type", "application/json")

	UpdateModelTranslation(context)

	assert.Equal(t, http.StatusConflict, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Code    string `json:"code"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, "MODEL_TRANSLATION_SOURCE_CHANGED", response.Code)
	stored, err := model.GetModelTranslation(source.Id, "fr")
	require.NoError(t, err)
	require.NotNil(t, stored)
	assert.Equal(t, "Existing translation", stored.Description)
	assert.Equal(t, model.TranslationStatusStale, stored.DescriptionStatus)
}
