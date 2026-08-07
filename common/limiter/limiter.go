package limiter

import (
	"context"
	_ "embed"
	"fmt"
	"strconv"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

//go:embed lua/rate_limit.lua
var rateLimitScript string

//go:embed lua/sliding_window.lua
var slidingWindowScript string

type RedisLimiter struct {
	client         *redis.Client
	limitScriptSHA string
}

var (
	instance *RedisLimiter
	once     sync.Once
)

func New(ctx context.Context, r *redis.Client) *RedisLimiter {
	once.Do(func() {
		// 预加载脚本
		limitSHA, err := r.ScriptLoad(ctx, rateLimitScript).Result()
		if err != nil {
			common.SysLog(fmt.Sprintf("Failed to load rate limit script: %v", err))
		}
		instance = &RedisLimiter{
			client:         r,
			limitScriptSHA: limitSHA,
		}
	})

	return instance
}

func (rl *RedisLimiter) Allow(ctx context.Context, key string, opts ...Option) (bool, error) {
	// 默认配置
	config := &Config{
		Capacity:  10,
		Rate:      1,
		Requested: 1,
	}

	// 应用选项模式
	for _, opt := range opts {
		opt(config)
	}

	// 执行限流
	rateStr := strconv.FormatFloat(config.Rate, 'f', -1, 64)
	result, err := rl.client.EvalSha(
		ctx,
		rl.limitScriptSHA,
		[]string{key},
		config.Requested,
		rateStr,
		config.Capacity,
	).Int()

	if err != nil {
		return false, fmt.Errorf("rate limit failed: %w", err)
	}
	return result == 1, nil
}

// SlidingWindowAllow admits one request when fewer than maxRequests entries
// occurred within the last window seconds, removing expired entries in the
// same atomic script. Member must be unique per admitted request so two calls
// in the same second both count.
func SlidingWindowAllow(ctx context.Context, client *redis.Client, key string, windowSeconds, maxRequests int64, member string) (bool, error) {
	script := redis.NewScript(slidingWindowScript)
	result, err := script.Run(ctx, client, []string{key}, windowSeconds, maxRequests, member).Int()
	if err != nil {
		return false, fmt.Errorf("sliding window rate limit failed: %w", err)
	}
	return result == 1, nil
}

// Config 配置选项模式
type Config struct {
	Capacity  int64
	Rate      float64
	Requested int64
}

type Option func(*Config)

func WithCapacity(c int64) Option {
	return func(cfg *Config) { cfg.Capacity = c }
}

// WithRate sets the token refill rate (tokens per second). The value may be
// fractional, e.g. 0.5 for one request every two seconds.
func WithRate(r float64) Option {
	return func(cfg *Config) { cfg.Rate = r }
}

func WithRequested(n int64) Option {
	return func(cfg *Config) { cfg.Requested = n }
}
