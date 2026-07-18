package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPricingCanRequireConfiguredModels(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
		t.Cleanup(func() {
			common.OptionMap = nil
		})
	}

	const optionKey = "global.model_square_only_configured_models"
	originalSetting := model_setting.GetGlobalSettings().ModelSquareOnlyConfiguredModels
	require.NoError(t, UpdateOption(optionKey, "false"))
	t.Cleanup(func() {
		require.NoError(t, UpdateOption(optionKey, strconv.FormatBool(originalSetting)))
	})

	insertPricingEndpointChannel(t, 501, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	modelNames := []string{
		"configured-exact",
		"prefix-configured-model",
		"model-configured-suffix",
		"model-configured-contains-value",
		"configured-disabled",
		"unconfigured-model",
	}
	for _, modelName := range modelNames {
		insertPricingEndpointAbility(t, 501, modelName)
	}

	models := []Model{
		{ModelName: "configured-exact", Status: 1, NameRule: NameRuleExact},
		{ModelName: "prefix-configured-", Status: 1, NameRule: NameRulePrefix},
		{ModelName: "-configured-suffix", Status: 1, NameRule: NameRuleSuffix},
		{ModelName: "-configured-contains-", Status: 1, NameRule: NameRuleContains},
		{ModelName: "configured-disabled", Status: 1, NameRule: NameRuleExact},
	}
	require.NoError(t, DB.Create(&models).Error)
	require.NoError(t, DB.Model(&Model{}).
		Where("model_name = ?", "configured-disabled").
		Update("status", 0).Error)

	loosePricing := make(map[string]Pricing)
	for _, pricing := range GetPricing() {
		loosePricing[pricing.ModelName] = pricing
	}
	assert.Contains(t, loosePricing, "unconfigured-model")
	assert.NotContains(t, loosePricing, "configured-disabled")

	// Updating the option must invalidate the already-built pricing cache.
	require.NoError(t, UpdateOption(optionKey, "true"))
	strictPricing := make(map[string]Pricing)
	for _, pricing := range GetPricing() {
		strictPricing[pricing.ModelName] = pricing
	}
	assert.Contains(t, strictPricing, "configured-exact")
	assert.Contains(t, strictPricing, "prefix-configured-model")
	assert.Contains(t, strictPricing, "model-configured-suffix")
	assert.Contains(t, strictPricing, "model-configured-contains-value")
	assert.NotContains(t, strictPricing, "configured-disabled")
	assert.NotContains(t, strictPricing, "unconfigured-model")

	assert.ElementsMatch(t, modelNames, GetEnabledModels())
}
