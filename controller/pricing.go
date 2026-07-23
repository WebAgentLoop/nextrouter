package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/translation_setting"

	"github.com/gin-gonic/gin"
)

func getPricingUserGroup(c *gin.Context) (string, bool) {
	userID, exists := c.Get("id")
	if !exists {
		return "", false
	}
	id, ok := userID.(int)
	if !ok {
		return "", false
	}
	user, err := model.GetUserCache(id)
	if err != nil {
		return "", false
	}
	return user.Group, true
}

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	group, hasUser := getPricingUserGroup(c)
	usableGroup := service.GetUserUsableGroups(group)
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	if hasUser {
		for g := range groupRatio {
			ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
			if ok {
				groupRatio[g] = ratio
			}
		}
	}

	pricing = filterPricingByUsableGroups(pricing, usableGroup)
	requestedLanguage := translation_setting.NormalizeLanguage(c.Query("lang"))
	fallbackLanguage := translation_setting.GetTranslationSetting().FallbackLanguage
	if requestedLanguage == "" {
		requestedLanguage = fallbackLanguage
	}
	modelIDs := make([]int, 0, len(pricing))
	for _, item := range pricing {
		if item.ModelID > 0 {
			modelIDs = append(modelIDs, item.ModelID)
		}
	}
	translations, translateErr := model.GetModelTranslationsForLocales(modelIDs, []string{requestedLanguage, fallbackLanguage})
	if translateErr != nil {
		common.SysError("load localized model descriptions failed: " + translateErr.Error())
	} else {
		translationsByModel := make(map[int][]model.ModelTranslation)
		for _, translation := range translations {
			translationsByModel[translation.ModelID] = append(translationsByModel[translation.ModelID], translation)
		}
		localized := make([]model.Pricing, len(pricing))
		copy(localized, pricing)
		for i := range localized {
			if requestedLanguage == localized[i].SourceLanguage {
				localized[i].DescriptionLanguage = localized[i].SourceLanguage
				continue
			}
			description, language := model.ResolveTranslatedDescription(localized[i].Description, requestedLanguage, fallbackLanguage, translationsByModel[localized[i].ModelID])
			localized[i].Description = description
			if language == "" {
				language = localized[i].SourceLanguage
			}
			localized[i].DescriptionLanguage = language
		}
		pricing = localized
	}
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"pricing_version":    "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func GetModelDocumentation(c *gin.Context) {
	modelName := c.Query("model")
	if strings.TrimSpace(modelName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	group, _ := getPricingUserGroup(c)
	visiblePricing := filterPricingByUsableGroups(
		model.GetPricing(),
		service.GetUserUsableGroups(group),
	)

	documentationModelID := 0
	for _, item := range visiblePricing {
		if item.ModelName == modelName && item.HasDocumentation {
			documentationModelID = item.DocumentationModelID
			break
		}
	}
	if documentationModelID == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "model documentation not found",
		})
		return
	}

	var modelMeta model.Model
	if err := model.DB.Select("id", "model_name", "documentation", "source_language").First(&modelMeta, documentationModelID).Error; err != nil || strings.TrimSpace(modelMeta.Documentation) == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "model documentation not found",
		})
		return
	}

	requestedLanguage := translation_setting.NormalizeLanguage(c.Query("lang"))
	fallbackLanguage := translation_setting.GetTranslationSetting().FallbackLanguage
	if requestedLanguage == "" {
		requestedLanguage = fallbackLanguage
	}
	documentation := modelMeta.Documentation
	contentLanguage := modelMeta.SourceLanguage
	if requestedLanguage != modelMeta.SourceLanguage {
		translations, err := model.GetModelTranslationsForLocales([]int{documentationModelID}, []string{requestedLanguage, fallbackLanguage})
		if err != nil {
			common.SysError("load localized model documentation failed: " + err.Error())
		} else {
			resolved, language := model.ResolveTranslatedDocumentation(modelMeta.Documentation, requestedLanguage, fallbackLanguage, translations)
			documentation = resolved
			if language != "" {
				contentLanguage = language
			}
		}
	}
	common.ApiSuccess(c, gin.H{
		"model_name":       modelName,
		"documentation":    documentation,
		"content_language": contentLanguage,
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
