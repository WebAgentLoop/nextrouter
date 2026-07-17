package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type RankingQuotaTotal struct {
	ModelName   string `json:"model_name"`
	TotalTokens int64  `json:"total_tokens"`
}

type RankingQuotaBucket struct {
	ModelName string `json:"model_name"`
	Bucket    int64  `json:"bucket"`
	Tokens    int64  `json:"tokens"`
}

type rankingQuotaMonthBucket struct {
	ModelName string `gorm:"column:model_name"`
	MonthKey  int64  `gorm:"column:month_key"`
	Tokens    int64  `gorm:"column:tokens"`
}

func GetRankingQuotaTotals(startTime int64, endTime int64) ([]RankingQuotaTotal, error) {
	var rows []RankingQuotaTotal
	query := DB.Table("quota_data").
		Select("model_name, sum(token_used) as total_tokens").
		Where("model_name <> ''").
		Group("model_name").
		Having("sum(token_used) > 0").
		Order("total_tokens DESC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

func GetRankingQuotaBuckets(startTime int64, endTime int64, bucketSize int64) ([]RankingQuotaBucket, error) {
	if bucketSize <= 0 {
		bucketSize = 3600
	}
	bucketExpr := rankingBucketExpr(bucketSize)
	var rows []RankingQuotaBucket
	query := DB.Table("quota_data").
		Select(fmt.Sprintf("model_name, %s as bucket, sum(token_used) as tokens", bucketExpr)).
		Where("model_name <> ''").
		Group(fmt.Sprintf("model_name, %s", bucketExpr)).
		Having("sum(token_used) > 0").
		Order("bucket ASC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

func GetRankingQuotaMonthlyBuckets(startTime int64, endTime int64) ([]RankingQuotaBucket, error) {
	monthExpr := rankingMonthExpr()
	var monthRows []rankingQuotaMonthBucket
	query := DB.Table("quota_data").
		Select(fmt.Sprintf("model_name, %s as month_key, sum(token_used) as tokens", monthExpr)).
		Where("model_name <> ''").
		Group(fmt.Sprintf("model_name, %s", monthExpr)).
		Having("sum(token_used) > 0").
		Order("month_key ASC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	if err := query.Find(&monthRows).Error; err != nil {
		return nil, err
	}

	rows := make([]RankingQuotaBucket, 0, len(monthRows))
	for _, row := range monthRows {
		year := int(row.MonthKey / 100)
		month := time.Month(row.MonthKey % 100)
		if year < 1 || month < time.January || month > time.December {
			return nil, fmt.Errorf("invalid ranking month key: %d", row.MonthKey)
		}
		rows = append(rows, RankingQuotaBucket{
			ModelName: row.ModelName,
			Bucket:    time.Date(year, month, 1, 0, 0, 0, 0, time.UTC).Unix(),
			Tokens:    row.Tokens,
		})
	}
	return rows, nil
}

func rankingBucketExpr(bucketSize int64) string {
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		return fmt.Sprintf("FLOOR(created_at / %d) * %d", bucketSize, bucketSize)
	}
	return fmt.Sprintf("(created_at / %d) * %d", bucketSize, bucketSize)
}

func rankingMonthExpr() string {
	switch {
	case common.UsingMainDatabase(common.DatabaseTypeMySQL):
		return "EXTRACT(YEAR_MONTH FROM DATE_ADD('1970-01-01 00:00:00', INTERVAL created_at SECOND))"
	case common.UsingMainDatabase(common.DatabaseTypePostgreSQL):
		return "CAST(TO_CHAR(TIMESTAMP 'epoch' + created_at * INTERVAL '1 second', 'YYYYMM') AS BIGINT)"
	default:
		return "CAST(strftime('%Y%m', created_at, 'unixepoch') AS INTEGER)"
	}
}

func applyRankingQuotaTimeRange(query *gorm.DB, startTime int64, endTime int64) *gorm.DB {
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}
