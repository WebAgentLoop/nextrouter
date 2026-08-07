-- Sliding window rate limiter.
-- Keeps one sorted-set entry (member, score = unix second) per admitted
-- request and admits only when fewer than maxRequests entries fall within the
-- last window seconds. This mirrors common.InMemoryRateLimiter semantics so
-- the Redis and in-memory backends behave identically.
-- KEYS[1] = sorted-set key
-- ARGV[1] = window length in seconds
-- ARGV[2] = maximum requests allowed within the window
-- ARGV[3] = unique member for the incoming request
local key = KEYS[1]
local window = tonumber(ARGV[1])
local maxRequests = tonumber(ARGV[2])
local member = ARGV[3]

local now = redis.call('TIME')[1]
local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local count = redis.call('ZCARD', key)
if count >= maxRequests then
    if count == 0 then
        redis.call('DEL', key)
    end
    return 0
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, window + 60)
return 1