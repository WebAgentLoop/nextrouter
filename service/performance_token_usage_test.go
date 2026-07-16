package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPerformanceInputTokenUsage(t *testing.T) {
	tests := []struct {
		name           string
		usage          *dto.Usage
		isClaude       bool
		wantCached     int64
		wantInputTotal int64
	}{
		{
			name: "openai prompt total includes cached tokens",
			usage: &dto.Usage{
				PromptTokens: 100,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 30,
				},
			},
			wantCached:     30,
			wantInputTotal: 100,
		},
		{
			name: "responses input details fallback",
			usage: &dto.Usage{
				InputTokens: 80,
				InputTokensDetails: &dto.InputTokenDetails{
					CachedTokens: 20,
				},
			},
			wantCached:     20,
			wantInputTotal: 80,
		},
		{
			name: "legacy prompt cache hit fallback",
			usage: &dto.Usage{
				PromptTokens:         60,
				PromptCacheHitTokens: 15,
			},
			wantCached:     15,
			wantInputTotal: 60,
		},
		{
			name: "claude input adds cache read and creation",
			usage: &dto.Usage{
				PromptTokens: 70,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:         30,
					CachedCreationTokens: 20,
				},
			},
			isClaude:       true,
			wantCached:     30,
			wantInputTotal: 120,
		},
		{
			name: "normalized claude total is not double counted",
			usage: &dto.Usage{
				PromptTokens: 70,
				InputTokens:  120,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:         30,
					CachedCreationTokens: 20,
				},
			},
			isClaude:       true,
			wantCached:     30,
			wantInputTotal: 120,
		},
		{
			name:           "missing usage has no token data",
			usage:          nil,
			wantCached:     0,
			wantInputTotal: 0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cached, inputTotal := performanceInputTokenUsage(test.usage, test.isClaude)

			require.GreaterOrEqual(t, inputTotal, int64(0))
			assert.Equal(t, test.wantCached, cached)
			assert.Equal(t, test.wantInputTotal, inputTotal)
		})
	}
}
