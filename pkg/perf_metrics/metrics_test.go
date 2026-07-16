package perfmetrics

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildQueryResultUsesTokenWeightedCacheHitRate(t *testing.T) {
	result := buildQueryResult("gpt-test", map[bucketKey]counters{
		{model: "gpt-test", group: "fast", bucketTs: 100}: {
			requestCount:      1,
			cachedInputTokens: 100,
			inputTokens:       100,
		},
		{model: "gpt-test", group: "standard", bucketTs: 100}: {
			requestCount: 1,
			inputTokens:  900,
		},
	}, nil)

	require.NotNil(t, result.CacheHitRate)
	assert.Equal(t, 10.0, *result.CacheHitRate)
	require.Len(t, result.Groups, 2)
	require.NotNil(t, result.Groups[0].CacheHitRate)
	assert.Equal(t, 100.0, *result.Groups[0].CacheHitRate)
	require.NotNil(t, result.Groups[1].CacheHitRate)
	assert.Equal(t, 0.0, *result.Groups[1].CacheHitRate)
}

func TestBuildQueryResultDistinguishesNoTokenData(t *testing.T) {
	result := buildQueryResult("gpt-test", map[bucketKey]counters{
		{model: "gpt-test", group: "default", bucketTs: 100}: {
			requestCount: 1,
		},
	}, nil)

	assert.Nil(t, result.CacheHitRate)
	require.Len(t, result.Groups, 1)
	assert.Nil(t, result.Groups[0].CacheHitRate)
	require.Len(t, result.Groups[0].Series, 1)
	assert.Nil(t, result.Groups[0].Series[0].CacheHitRate)
}

func TestCacheHitRateCapsInconsistentUpstreamUsage(t *testing.T) {
	rate := cacheHitRate(counters{cachedInputTokens: 120, inputTokens: 100})

	require.NotNil(t, rate)
	assert.Equal(t, 100.0, *rate)
}

func TestBuildQueryResultExcludesDisallowedGroupsFromModelRate(t *testing.T) {
	result := buildQueryResult("gpt-test", map[bucketKey]counters{
		{model: "gpt-test", group: "public", bucketTs: 100}: {
			requestCount: 1,
			inputTokens:  900,
		},
		{model: "gpt-test", group: "hidden", bucketTs: 100}: {
			requestCount:      1,
			cachedInputTokens: 100,
			inputTokens:       100,
		},
	}, map[string]struct{}{"public": {}})

	require.NotNil(t, result.CacheHitRate)
	assert.Equal(t, 0.0, *result.CacheHitRate)
	require.Len(t, result.Groups, 1)
	assert.Equal(t, "public", result.Groups[0].Group)
}
