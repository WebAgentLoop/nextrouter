package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/translation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelInsertDefaultsSourceLanguage(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}))
	source := Model{ModelName: "translation-default-language", Status: 1}
	require.NoError(t, source.Insert())
	assert.Equal(t, translation_setting.GetTranslationSetting().DefaultSourceLanguage, source.SourceLanguage)
}

func TestResolveTranslatedDescriptionUsesRequestedThenFallbackLanguage(t *testing.T) {
	source := "中文描述"
	sourceHash := ModelContentHash(source)
	translations := []ModelTranslation{
		{Locale: "en", Description: "English description", DescriptionSourceHash: sourceHash, DescriptionStatus: TranslationStatusCompleted},
		{Locale: "fr", Description: "Description française", DescriptionSourceHash: sourceHash, DescriptionStatus: TranslationStatusCompleted},
	}

	description, language := ResolveTranslatedDescription(source, "fr", "en", translations)
	assert.Equal(t, "Description française", description)
	assert.Equal(t, "fr", language)

	description, language = ResolveTranslatedDescription(source, "ja", "en", translations)
	assert.Equal(t, "English description", description)
	assert.Equal(t, "en", language)
}

func TestResolveTranslatedDocumentationRejectsOutdatedSourceHash(t *testing.T) {
	source := "# 新文档"
	translations := []ModelTranslation{
		{Locale: "en", Documentation: "# Old guide", DocumentationSourceHash: ModelContentHash("# 旧文档"), DocumentationStatus: TranslationStatusCompleted},
	}

	documentation, language := ResolveTranslatedDocumentation(source, "en", "en", translations)
	assert.Equal(t, source, documentation)
	assert.Empty(t, language)
}

func TestModelUpdateMarksOnlyChangedTranslationContentStale(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}, &ModelTranslation{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM model_translations")
		DB.Exec("DELETE FROM models")
	})
	source := Model{ModelName: "translation-stale-test", Description: "Old description", Documentation: "# Guide", SourceLanguage: "en", Status: 1}
	require.NoError(t, source.Insert())
	translation := ModelTranslation{
		ModelID: source.Id, Locale: "fr",
		Description: "Ancienne description", DescriptionSourceHash: ModelContentHash(source.Description), DescriptionStatus: TranslationStatusCompleted,
		Documentation: "# Guide FR", DocumentationSourceHash: ModelContentHash(source.Documentation), DocumentationStatus: TranslationStatusCompleted,
	}
	require.NoError(t, DB.Create(&translation).Error)

	source.Description = "New description"
	require.NoError(t, source.Update())

	stored, err := GetModelTranslation(source.Id, "fr")
	require.NoError(t, err)
	require.NotNil(t, stored)
	assert.Equal(t, TranslationStatusStale, stored.DescriptionStatus)
	assert.Equal(t, TranslationStatusCompleted, stored.DocumentationStatus)
}

func TestModelUpdateMarksAllTranslationContentStaleWhenSourceLanguageChanges(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}, &ModelTranslation{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM model_translations")
		DB.Exec("DELETE FROM models")
	})
	source := Model{ModelName: "translation-language-test", Description: "Description", Documentation: "# Guide", SourceLanguage: "en", Status: 1}
	require.NoError(t, source.Insert())
	require.NoError(t, DB.Create(&ModelTranslation{
		ModelID: source.Id, Locale: "fr",
		Description: "Description FR", DescriptionSourceHash: ModelContentHash(source.Description), DescriptionStatus: TranslationStatusCompleted,
		Documentation: "# Guide FR", DocumentationSourceHash: ModelContentHash(source.Documentation), DocumentationStatus: TranslationStatusCompleted,
	}).Error)

	source.SourceLanguage = "zh-CN"
	require.NoError(t, source.Update())

	stored, err := GetModelTranslation(source.Id, "fr")
	require.NoError(t, err)
	require.NotNil(t, stored)
	assert.Equal(t, TranslationStatusStale, stored.DescriptionStatus)
	assert.Equal(t, TranslationStatusStale, stored.DocumentationStatus)
}

func TestSaveManualModelTranslationRejectsChangedSourceAtomically(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}, &ModelTranslation{}))
	source := Model{ModelName: "manual-translation-conflict", Description: "Old description", Documentation: "# Old guide", SourceLanguage: "en", Status: 1}
	require.NoError(t, source.Insert())
	require.NoError(t, DB.Create(&ModelTranslation{
		ModelID: source.Id, Locale: "fr",
		Description: "Existing description", DescriptionSourceHash: ModelContentHash(source.Description), DescriptionStatus: TranslationStatusCompleted,
		Documentation: "# Existing guide", DocumentationSourceHash: ModelContentHash(source.Documentation), DocumentationStatus: TranslationStatusCompleted,
	}).Error)
	descriptionVersion := ModelSourceVersionHash(source.SourceLanguage, source.Description)
	documentationVersion := ModelSourceVersionHash(source.SourceLanguage, source.Documentation)
	source.Description = "New description"
	require.NoError(t, source.Update())

	description := "Ancienne description"
	documentation := "# Ancien guide"
	_, err := SaveManualModelTranslation(source.Id, "fr", ManualModelTranslationUpdate{
		Description:                &description,
		Documentation:              &documentation,
		DescriptionSourceVersion:   descriptionVersion,
		DocumentationSourceVersion: documentationVersion,
	})
	require.ErrorIs(t, err, ErrModelTranslationSourceChanged)

	stored, err := GetModelTranslation(source.Id, "fr")
	require.NoError(t, err)
	require.NotNil(t, stored)
	assert.Equal(t, "Existing description", stored.Description)
	assert.Equal(t, "# Existing guide", stored.Documentation)
	assert.Equal(t, TranslationStatusStale, stored.DescriptionStatus)
	assert.Equal(t, TranslationStatusCompleted, stored.DocumentationStatus)
}

func TestSaveManualModelTranslationUpdatesOnlySubmittedContent(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}, &ModelTranslation{}))
	source := Model{ModelName: "manual-translation-selective", Description: "Description", Documentation: "# Guide", SourceLanguage: "en", Status: 1}
	require.NoError(t, source.Insert())
	require.NoError(t, DB.Create(&ModelTranslation{
		ModelID: source.Id, Locale: "fr",
		Description: "Old description", DescriptionStatus: TranslationStatusStale,
		Documentation: "# Outdated guide", DocumentationSourceHash: "outdated", DocumentationStatus: TranslationStatusStale,
	}).Error)

	description := "Description française"
	saved, err := SaveManualModelTranslation(source.Id, "fr", ManualModelTranslationUpdate{
		Description:              &description,
		DescriptionSourceVersion: ModelSourceVersionHash(source.SourceLanguage, source.Description),
	})
	require.NoError(t, err)
	assert.Equal(t, description, saved.Description)
	assert.Equal(t, TranslationStatusCompleted, saved.DescriptionStatus)
	assert.Equal(t, "# Outdated guide", saved.Documentation)
	assert.Equal(t, "outdated", saved.DocumentationSourceHash)
	assert.Equal(t, TranslationStatusStale, saved.DocumentationStatus)
}
