package service

import (
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetRankingsSnapshotAllUsesMonthlyBucketsAndSharesConcurrentBuild(t *testing.T) {
	truncate(t)
	model.InvalidatePricingCache()
	originalLocal := time.Local
	time.Local = time.FixedZone("UTC-8", -8*60*60)
	t.Cleanup(func() {
		time.Local = originalLocal
	})

	rows := []model.QuotaData{
		{ModelName: "model-a", CreatedAt: time.Date(2023, time.January, 20, 0, 0, 0, 0, time.UTC).Unix(), TokenUsed: 10},
		{ModelName: "model-a", CreatedAt: time.Date(2025, time.February, 1, 0, 0, 0, 0, time.UTC).Unix(), TokenUsed: 20},
		{ModelName: "model-b", CreatedAt: time.Date(2025, time.February, 28, 23, 59, 59, 0, time.UTC).Unix(), TokenUsed: 5},
	}
	for idx := range rows {
		require.NoError(t, model.DB.Create(&rows[idx]).Error)
	}

	rankingCacheMu.Lock()
	rankingCache = map[string]rankingCacheItem{}
	rankingCacheMu.Unlock()
	t.Cleanup(func() {
		rankingCacheMu.Lock()
		rankingCache = map[string]rankingCacheItem{}
		rankingCacheMu.Unlock()
		model.InvalidatePricingCache()
	})

	const callbackName = "rankings_test:count_quota_queries"
	firstQueryStarted := make(chan struct{})
	releaseFirstQuery := make(chan struct{})
	var blockFirstQuery sync.Once
	var quotaQueryCount atomic.Int32
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "quota_data" {
			return
		}
		quotaQueryCount.Add(1)
		blockFirstQuery.Do(func() {
			close(firstQueryStarted)
			<-releaseFirstQuery
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	type snapshotResult struct {
		snapshot *RankingsResponse
		err      error
	}
	const requestCount = 6
	results := make(chan snapshotResult, requestCount)
	go func() {
		snapshot, err := GetRankingsSnapshot("all")
		results <- snapshotResult{snapshot: snapshot, err: err}
	}()
	<-firstQueryStarted

	startWaiters := make(chan struct{})
	waitersReady := make(chan struct{}, requestCount-1)
	for range requestCount - 1 {
		go func() {
			waitersReady <- struct{}{}
			<-startWaiters
			snapshot, err := GetRankingsSnapshot("all")
			results <- snapshotResult{snapshot: snapshot, err: err}
		}()
	}
	for range requestCount - 1 {
		<-waitersReady
	}
	close(startWaiters)
	runtime.Gosched()
	close(releaseFirstQuery)

	var firstSnapshot *RankingsResponse
	for range requestCount {
		result := <-results
		require.NoError(t, result.err)
		require.NotNil(t, result.snapshot)
		if firstSnapshot == nil {
			firstSnapshot = result.snapshot
			continue
		}
		assert.Same(t, firstSnapshot, result.snapshot)
	}
	assert.Equal(t, int32(2), quotaQueryCount.Load())

	require.Len(t, firstSnapshot.Models, 2)
	assert.Equal(t, int64(30), firstSnapshot.Models[0].TotalTokens)
	for _, rankedModel := range firstSnapshot.Models {
		assert.Nil(t, rankedModel.PreviousRank)
		assert.Equal(t, float64(100), rankedModel.GrowthPct)
	}
	for _, vendor := range firstSnapshot.Vendors {
		assert.Equal(t, float64(100), vendor.GrowthPct)
	}
	assert.Empty(t, firstSnapshot.TopMovers)
	assert.Empty(t, firstSnapshot.TopDroppers)

	monthTotals := make(map[string]int64)
	monthLabels := make(map[string]string)
	for _, point := range firstSnapshot.ModelsHistory.Points {
		monthTotals[point.Model+"/"+point.Ts] = point.Tokens
		monthLabels[point.Ts] = point.Label
	}
	assert.Equal(t, map[string]int64{
		"model-a/2023-01-01T00:00:00Z": 10,
		"model-a/2025-02-01T00:00:00Z": 20,
		"model-b/2025-02-01T00:00:00Z": 5,
	}, monthTotals)
	assert.Equal(t, map[string]string{
		"2023-01-01T00:00:00Z": "Jan 2023",
		"2025-02-01T00:00:00Z": "Feb 2025",
	}, monthLabels)
}
