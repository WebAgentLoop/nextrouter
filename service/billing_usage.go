package service

import (
	"math"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

func performanceInputTokenUsage(usage *dto.Usage, isClaudeUsageSemantic bool) (int64, int64) {
	if usage == nil {
		return 0, 0
	}

	cachedInputTokens := usage.PromptTokensDetails.CachedTokens
	cacheCreationTokens := usage.PromptTokensDetails.CacheCreationTokensTotal()
	if usage.InputTokensDetails != nil {
		if cachedInputTokens <= 0 {
			cachedInputTokens = usage.InputTokensDetails.CachedTokens
		}
		if inputCacheCreationTokens := usage.InputTokensDetails.CacheCreationTokensTotal(); inputCacheCreationTokens > cacheCreationTokens {
			cacheCreationTokens = inputCacheCreationTokens
		}
	}
	if cachedInputTokens <= 0 {
		cachedInputTokens = usage.PromptCacheHitTokens
	}

	cached := positivePerformanceTokens(cachedInputTokens)
	if usage.InputTokens > 0 {
		return cached, positivePerformanceTokens(usage.InputTokens)
	}

	total := positivePerformanceTokens(usage.PromptTokens)
	if !isClaudeUsageSemantic {
		return cached, total
	}

	total = addPerformanceTokens(total, cachedInputTokens)
	cacheCreation5mAnd1h := addPerformanceTokens(0, usage.ClaudeCacheCreation5mTokens)
	cacheCreation5mAnd1h = addPerformanceTokens(cacheCreation5mAnd1h, usage.ClaudeCacheCreation1hTokens)
	if cacheCreation5mAnd1h > positivePerformanceTokens(cacheCreationTokens) {
		return cached, saturatingAddPerformanceTokens(total, cacheCreation5mAnd1h)
	}
	return cached, addPerformanceTokens(total, cacheCreationTokens)
}

func positivePerformanceTokens(value int) int64 {
	if value <= 0 {
		return 0
	}
	return int64(value)
}

func addPerformanceTokens(total int64, value int) int64 {
	return saturatingAddPerformanceTokens(total, positivePerformanceTokens(value))
}

func saturatingAddPerformanceTokens(total int64, value int64) int64 {
	if value <= 0 {
		return total
	}
	if total > math.MaxInt64-value {
		return math.MaxInt64
	}
	return total + value
}

const (
	usageBillingPathLocal              = "local"
	usageBillingPathUpstream           = "upstream"
	usageBillingPathOpenAI             = "billing-usage-openai"
	usageBillingPathOpenAIEstimated    = "billing-usage-openai-estimated"
	usageBillingPathAnthropic          = "billing-usage-anthropic"
	usageBillingPathAnthropicEstimated = "billing-usage-anthropic-estimated"
	usageBillingPathGemini             = "billing-usage-gemini"
	usageBillingPathGeminiEstimated    = "billing-usage-gemini-estimated"
)

func effectiveBillingUsage(usage *dto.Usage) *dto.Usage {
	if billingUsage, ok := usageFromBillingUsage(usage); ok {
		return billingUsage
	}
	return usage
}

func usageBillingPathForLog(isLocalCountTokens bool, usage *dto.Usage) string {
	effectiveUsage, ok := usageFromBillingUsage(usage)
	if !ok {
		if isLocalCountTokens {
			return usageBillingPathLocal
		}
		return usageBillingPathUpstream
	}

	switch effectiveUsage.UsageSemantic {
	case dto.BillingUsageSemanticOpenAI:
		if usage.BillingUsage.Estimated {
			return usageBillingPathOpenAIEstimated
		}
		return usageBillingPathOpenAI
	case dto.BillingUsageSemanticAnthropic:
		if usage.BillingUsage.Estimated {
			return usageBillingPathAnthropicEstimated
		}
		return usageBillingPathAnthropic
	case dto.BillingUsageSemanticGemini:
		if usage.BillingUsage.Estimated {
			return usageBillingPathGeminiEstimated
		}
		return usageBillingPathGemini
	}

	return usageBillingPathUpstream
}

func appendUsageBillingPathForLog(other *model.LogOther, isLocalCountTokens bool, usage *dto.Usage) {
	if other == nil {
		return
	}
	other.SetAdmin("usage_billing_path", usageBillingPathForLog(isLocalCountTokens, usage))
}

func usageFromBillingUsage(usage *dto.Usage) (*dto.Usage, bool) {
	if usage == nil || usage.BillingUsage == nil {
		return nil, false
	}
	return usage.BillingUsage.CanonicalUsage()
}
