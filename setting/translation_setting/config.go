package translation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	DefaultSourceLanguage   = "en"
	DefaultFallbackLanguage = "en"
	DefaultModel            = "gpt-4o-mini"
	DefaultGroup            = "default"
)

// TranslationSetting 控制基于 LLM 的模型文档自动翻译。
// 通过 config.GlobalConfig 注册，持久化到 options 表（key 形如 translation_setting.enabled），
// 修改后由 model.updateOptionMap 即时回写到内存，无需重启。
type TranslationSetting struct {
	Enabled               bool   `json:"enabled"`
	DefaultSourceLanguage string `json:"default_source_language"`
	FallbackLanguage      string `json:"fallback_language"`
	Model                 string `json:"model"`
	Group                 string `json:"group"`
}

var translationSetting = TranslationSetting{
	Enabled:               false,
	DefaultSourceLanguage: DefaultSourceLanguage,
	FallbackLanguage:      DefaultFallbackLanguage,
	Model:                 DefaultModel,
	Group:                 DefaultGroup,
}

func init() {
	config.GlobalConfig.Register("translation_setting", &translationSetting)
}

// GetTranslationSetting 返回经过规范化处理（去空白、兜底默认值）的配置副本。
func GetTranslationSetting() TranslationSetting {
	result := translationSetting
	result.DefaultSourceLanguage = NormalizeLanguage(result.DefaultSourceLanguage)
	result.FallbackLanguage = NormalizeLanguage(result.FallbackLanguage)
	result.Model = strings.TrimSpace(result.Model)
	result.Group = strings.TrimSpace(result.Group)
	if result.DefaultSourceLanguage == "" {
		result.DefaultSourceLanguage = DefaultSourceLanguage
	}
	if result.FallbackLanguage == "" {
		result.FallbackLanguage = DefaultFallbackLanguage
	}
	if result.Model == "" {
		result.Model = DefaultModel
	}
	if result.Group == "" {
		result.Group = DefaultGroup
	}
	return result
}

var supportedLanguages = map[string]struct{}{
	"en": {}, "zh-CN": {}, "zh-TW": {}, "fr": {}, "ja": {}, "ru": {}, "vi": {},
}

func NormalizeLanguage(language string) string {
	switch strings.ToLower(strings.ReplaceAll(strings.TrimSpace(language), "_", "-")) {
	case "zh", "zh-cn", "zh-hans", "zhcn":
		return "zh-CN"
	case "zh-tw", "zh-hk", "zh-mo", "zh-hant", "zhtw":
		return "zh-TW"
	case "en", "fr", "ja", "ru", "vi":
		return strings.ToLower(strings.TrimSpace(language))
	default:
		return ""
	}
}

func IsSupportedLanguage(language string) bool {
	_, ok := supportedLanguages[NormalizeLanguage(language)]
	return ok
}
