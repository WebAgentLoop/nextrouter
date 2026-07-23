package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrModelTranslationSourceChanged = errors.New("model translation source content changed")

type ManualModelTranslationUpdate struct {
	Description                *string
	Documentation              *string
	DescriptionSourceVersion   string
	DocumentationSourceVersion string
}

const (
	TranslationStatusPending     = "pending"
	TranslationStatusTranslating = "translating"
	TranslationStatusCompleted   = "completed"
	TranslationStatusFailed      = "failed"
	TranslationStatusStale       = "stale"
)

type ModelTranslation struct {
	Id                      int    `json:"id"`
	ModelID                 int    `json:"model_id" gorm:"uniqueIndex:uk_model_translation,priority:1;index"`
	Locale                  string `json:"locale" gorm:"type:varchar(16);uniqueIndex:uk_model_translation,priority:2"`
	Description             string `json:"description" gorm:"type:text"`
	Documentation           string `json:"documentation" gorm:"type:text"`
	DescriptionSourceHash   string `json:"description_source_hash" gorm:"type:varchar(64)"`
	DocumentationSourceHash string `json:"documentation_source_hash" gorm:"type:varchar(64)"`
	DescriptionStatus       string `json:"description_status" gorm:"type:varchar(16);index"`
	DocumentationStatus     string `json:"documentation_status" gorm:"type:varchar(16);index"`
	DescriptionError        string `json:"description_error" gorm:"type:text"`
	DocumentationError      string `json:"documentation_error" gorm:"type:text"`
	TranslatedTime          int64  `json:"translated_time" gorm:"bigint"`
	CreatedTime             int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime             int64  `json:"updated_time" gorm:"bigint"`
}

func ListModelTranslations(modelID int) ([]ModelTranslation, error) {
	var translations []ModelTranslation
	err := DB.Where("model_id = ?", modelID).Order("locale asc").Find(&translations).Error
	return translations, err
}

func GetModelTranslation(modelID int, locale string) (*ModelTranslation, error) {
	var translation ModelTranslation
	err := DB.Where("model_id = ? AND locale = ?", modelID, locale).First(&translation).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &translation, err
}

func GetModelTranslationsForLocales(modelIDs []int, locales []string) ([]ModelTranslation, error) {
	if len(modelIDs) == 0 || len(locales) == 0 {
		return []ModelTranslation{}, nil
	}
	var translations []ModelTranslation
	err := DB.Where("model_id IN ? AND locale IN ?", modelIDs, locales).Find(&translations).Error
	return translations, err
}

func ResolveTranslatedDescription(source string, requestedLocale string, fallbackLocale string, translations []ModelTranslation) (string, string) {
	sourceHash := ModelContentHash(source)
	for _, locale := range []string{requestedLocale, fallbackLocale} {
		for _, translation := range translations {
			if translation.Locale == locale && translation.DescriptionStatus == TranslationStatusCompleted && translation.DescriptionSourceHash == sourceHash && strings.TrimSpace(translation.Description) != "" {
				return translation.Description, locale
			}
		}
	}
	return source, ""
}

func ResolveTranslatedDocumentation(source string, requestedLocale string, fallbackLocale string, translations []ModelTranslation) (string, string) {
	sourceHash := ModelContentHash(source)
	for _, locale := range []string{requestedLocale, fallbackLocale} {
		for _, translation := range translations {
			if translation.Locale == locale && translation.DocumentationStatus == TranslationStatusCompleted && translation.DocumentationSourceHash == sourceHash && strings.TrimSpace(translation.Documentation) != "" {
				return translation.Documentation, locale
			}
		}
	}
	return source, ""
}

func EnsureModelTranslation(modelID int, locale string) (*ModelTranslation, error) {
	return ensureModelTranslation(DB, modelID, locale)
}

func ensureModelTranslation(db *gorm.DB, modelID int, locale string) (*ModelTranslation, error) {
	now := common.GetTimestamp()
	translation := &ModelTranslation{
		ModelID:     modelID,
		Locale:      locale,
		CreatedTime: now,
		UpdatedTime: now,
	}
	err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(translation).Error
	if err != nil {
		return nil, err
	}
	var stored ModelTranslation
	if err := db.Where("model_id = ? AND locale = ?", modelID, locale).First(&stored).Error; err != nil {
		return nil, err
	}
	return &stored, nil
}

func SetModelTranslationPending(modelID int, locale string, contents []string) error {
	return SetModelTranslationPendingWithTx(DB, modelID, locale, contents)
}

func SetModelTranslationPendingWithTx(tx *gorm.DB, modelID int, locale string, contents []string) error {
	translation, err := ensureModelTranslation(tx, modelID, locale)
	if err != nil {
		return err
	}
	updates := map[string]any{"updated_time": common.GetTimestamp()}
	for _, content := range contents {
		switch content {
		case "description":
			updates["description_status"] = TranslationStatusPending
			updates["description_error"] = ""
		case "documentation":
			updates["documentation_status"] = TranslationStatusPending
			updates["documentation_error"] = ""
		}
	}
	return tx.Model(translation).Updates(updates).Error
}

func SetModelTranslationRunning(modelID int, locale, content string) error {
	updates := map[string]any{"updated_time": common.GetTimestamp()}
	updates[content+"_status"] = TranslationStatusTranslating
	updates[content+"_error"] = ""
	return DB.Model(&ModelTranslation{}).Where("model_id = ? AND locale = ?", modelID, locale).Updates(updates).Error
}

func SaveModelTranslation(modelID int, locale, content, value, sourceHash string) error {
	now := common.GetTimestamp()
	updates := map[string]any{
		content:                  value,
		content + "_source_hash": sourceHash,
		content + "_status":      TranslationStatusCompleted,
		content + "_error":       "",
		"translated_time":        now,
		"updated_time":           now,
	}
	return DB.Model(&ModelTranslation{}).Where("model_id = ? AND locale = ?", modelID, locale).Updates(updates).Error
}

func SaveManualModelTranslation(modelID int, locale string, update ManualModelTranslationUpdate) (*ModelTranslation, error) {
	var saved ModelTranslation
	err := DB.Transaction(func(tx *gorm.DB) error {
		var source Model
		if err := lockForUpdate(tx).Select("id", "description", "documentation", "source_language").First(&source, modelID).Error; err != nil {
			return err
		}
		if update.Description != nil && update.DescriptionSourceVersion != ModelSourceVersionHash(source.SourceLanguage, source.Description) {
			return fmt.Errorf("%w: description", ErrModelTranslationSourceChanged)
		}
		if update.Documentation != nil && update.DocumentationSourceVersion != ModelSourceVersionHash(source.SourceLanguage, source.Documentation) {
			return fmt.Errorf("%w: documentation", ErrModelTranslationSourceChanged)
		}
		translation, err := ensureModelTranslation(tx, modelID, locale)
		if err != nil {
			return err
		}
		now := common.GetTimestamp()
		updates := map[string]any{"translated_time": now, "updated_time": now}
		if update.Description != nil {
			updates["description"] = strings.TrimSpace(*update.Description)
			updates["description_source_hash"] = ModelContentHash(source.Description)
			updates["description_status"] = TranslationStatusCompleted
			updates["description_error"] = ""
		}
		if update.Documentation != nil {
			updates["documentation"] = strings.TrimSpace(*update.Documentation)
			updates["documentation_source_hash"] = ModelContentHash(source.Documentation)
			updates["documentation_status"] = TranslationStatusCompleted
			updates["documentation_error"] = ""
		}
		if err := tx.Model(translation).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("model_id = ? AND locale = ?", modelID, locale).First(&saved).Error
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func FailModelTranslation(modelID int, locale, content string, translateErr error) error {
	message := "translation failed"
	if translateErr != nil {
		message = strings.TrimSpace(translateErr.Error())
	}
	return DB.Model(&ModelTranslation{}).Where("model_id = ? AND locale = ?", modelID, locale).Updates(map[string]any{
		content + "_status": TranslationStatusFailed,
		content + "_error":  message,
		"updated_time":      common.GetTimestamp(),
	}).Error
}

func StaleModelTranslation(modelID int, locale, content string) error {
	return DB.Model(&ModelTranslation{}).Where("model_id = ? AND locale = ?", modelID, locale).Updates(map[string]any{
		content + "_status": TranslationStatusStale,
		content + "_error":  "source content changed during translation",
		"updated_time":      common.GetTimestamp(),
	}).Error
}

func DeleteModelTranslation(modelID int, locale string) error {
	return DB.Where("model_id = ? AND locale = ?", modelID, locale).Delete(&ModelTranslation{}).Error
}
