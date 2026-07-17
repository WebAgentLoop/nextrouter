package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRankingQuotaMonthlyBucketsUsesUTCMonthBoundaries(t *testing.T) {
	truncateTables(t)

	rows := []QuotaData{
		{ModelName: "model-a", CreatedAt: time.Date(2025, time.January, 31, 23, 59, 59, 0, time.UTC).Unix(), TokenUsed: 10},
		{ModelName: "model-a", CreatedAt: time.Date(2025, time.February, 1, 0, 0, 0, 0, time.UTC).Unix(), TokenUsed: 20},
		{ModelName: "model-a", CreatedAt: time.Date(2025, time.February, 28, 23, 59, 59, 0, time.UTC).Unix(), TokenUsed: 5},
		{ModelName: "model-b", CreatedAt: time.Date(2025, time.February, 11, 12, 0, 0, 0, time.UTC).Unix(), TokenUsed: 3},
		{ModelName: "model-a", CreatedAt: time.Date(2025, time.March, 1, 0, 0, 0, 0, time.UTC).Unix(), TokenUsed: 7},
	}
	for idx := range rows {
		require.NoError(t, DB.Create(&rows[idx]).Error)
	}

	buckets, err := GetRankingQuotaMonthlyBuckets(0, time.Date(2025, time.April, 1, 0, 0, 0, 0, time.UTC).Unix())
	require.NoError(t, err)
	require.Len(t, buckets, 4)

	totals := make(map[string]int64, len(buckets))
	for _, bucket := range buckets {
		key := bucket.ModelName + "/" + time.Unix(bucket.Bucket, 0).UTC().Format("2006-01-02")
		totals[key] = bucket.Tokens
	}
	assert.Equal(t, map[string]int64{
		"model-a/2025-01-01": 10,
		"model-a/2025-02-01": 25,
		"model-a/2025-03-01": 7,
		"model-b/2025-02-01": 3,
	}, totals)

	februaryBuckets, err := GetRankingQuotaMonthlyBuckets(
		time.Date(2025, time.February, 1, 0, 0, 0, 0, time.UTC).Unix(),
		time.Date(2025, time.February, 28, 23, 59, 59, 0, time.UTC).Unix(),
	)
	require.NoError(t, err)
	require.Len(t, februaryBuckets, 2)
	for _, bucket := range februaryBuckets {
		assert.Equal(t, "2025-02-01", time.Unix(bucket.Bucket, 0).UTC().Format("2006-01-02"))
	}
}
