package service

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

const (
	channelRateLimitNamespace = "channel_rate_limit"

	// maxChannelRateLimitSelectionAttempts bounds how many channels the
	// selector examines when every candidate is currently rate limited. Once
	// reached, the request fails with ErrChannelRateLimited instead of looping
	// forever.
	maxChannelRateLimitSelectionAttempts = 5
)

// ErrChannelRateLimited marks a selection that failed only because every
// candidate channel is over its configured rate. It is NOT a channel failure:
// callers must not auto-disable the channel or record an error log for it.
var ErrChannelRateLimited = errors.New("channel is rate limited")

// channelRateLimitMemory is the shared in-memory sliding-window limiter used
// when Redis is disabled. It is pruned at the longest allowed window so buckets
// never expire while still within their configured window.
var channelRateLimitMemory common.InMemoryRateLimiter

func init() {
	channelRateLimitMemory.Init(time.Duration(dto.MaxChannelRateLimitWindowSeconds) * time.Second)
}

// channelRateLimitConfig returns the configured rate limit for the channel.
// A nil channel, unset config or a disabled config all mean "no limit".
func channelRateLimitConfig(channel *model.Channel) *dto.ChannelRateLimit {
	if channel == nil {
		return nil
	}
	return channel.GetOtherSettings().RateLimit
}

// channelRateLimitMemberSeed keeps Redis sliding-window members unique across
// requests that land in the same second.
var channelRateLimitMemberSeed atomic.Int64

// AllowChannelRequest reports whether the channel may accept one more upstream
// request right now. It always returns true when the channel has no rate limit
// configured. A denied request consumes nothing and never mutates the channel
// (no auto-disable, no cooldown): it is purely advisory throttling.
func AllowChannelRequest(channel *model.Channel) bool {
	rl := channelRateLimitConfig(channel)
	if !rl.IsEnabled() {
		return true
	}
	key := fmt.Sprintf("%s:%d", channelRateLimitNamespace, channel.Id)
	window := rl.WindowSeconds
	requests := rl.Requests

	if common.RedisEnabled {
		ctx := context.Background()
		// Sliding window: at most `requests` admissions per `window` seconds,
		// matching the in-memory path so both backends throttle identically.
		member := fmt.Sprintf("%d-%d", time.Now().UnixNano(), channelRateLimitMemberSeed.Add(1))
		allowed, err := limiter.SlidingWindowAllow(ctx, common.RDB, key, window, requests, member)
		if err != nil {
			// Fail-open: an unavailable Redis must not take traffic down.
			common.SysLog(fmt.Sprintf("channel rate limit check failed (channel #%d): %v", channel.Id, err))
			return true
		}
		return allowed
	}
	return channelRateLimitMemory.Request(key, int(requests), window)
}
