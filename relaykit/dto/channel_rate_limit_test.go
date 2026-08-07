package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelRateLimitValidate(t *testing.T) {
	// nil and disabled configs are always valid (no rate limiting).
	require.NoError(t, (*ChannelRateLimit)(nil).Validate())
	require.NoError(t, (&ChannelRateLimit{}).Validate())
	require.NoError(t, (&ChannelRateLimit{Enabled: false, Requests: 0, WindowSeconds: 1}).Validate())
	require.NoError(t, (&ChannelRateLimit{Enabled: true, Requests: 1, WindowSeconds: 1}).Validate())

	tests := []struct {
		name    string
		rl      *ChannelRateLimit
		wantErr bool
	}{
		{name: "enabled without requests", rl: &ChannelRateLimit{Enabled: true, WindowSeconds: 1}, wantErr: true},
		{name: "negative requests", rl: &ChannelRateLimit{Enabled: true, Requests: -1, WindowSeconds: 1}, wantErr: true},
		{name: "enabled without window", rl: &ChannelRateLimit{Enabled: true, Requests: 10}, wantErr: true},
		{name: "negative window", rl: &ChannelRateLimit{Enabled: true, Requests: 10, WindowSeconds: -1}, wantErr: true},
		{name: "requests over cap", rl: &ChannelRateLimit{Enabled: true, Requests: MaxChannelRateLimitRequests + 1, WindowSeconds: 1}, wantErr: true},
		{name: "window over cap", rl: &ChannelRateLimit{Enabled: true, Requests: 10, WindowSeconds: MaxChannelRateLimitWindowSeconds + 1}, wantErr: true},
		{name: "max bounds valid", rl: &ChannelRateLimit{Enabled: true, Requests: MaxChannelRateLimitRequests, WindowSeconds: MaxChannelRateLimitWindowSeconds}, wantErr: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.rl.Validate()
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestChannelRateLimitIsEnabled(t *testing.T) {
	assert.False(t, (*ChannelRateLimit)(nil).IsEnabled())
	assert.False(t, (&ChannelRateLimit{}).IsEnabled())
	assert.False(t, (&ChannelRateLimit{Enabled: true, Requests: 10}).IsEnabled())
	assert.False(t, (&ChannelRateLimit{Enabled: true, Requests: 0, WindowSeconds: 1}).IsEnabled())
	assert.False(t, (&ChannelRateLimit{Enabled: false, Requests: 10, WindowSeconds: 1}).IsEnabled())
	assert.True(t, (&ChannelRateLimit{Enabled: true, Requests: 10, WindowSeconds: 1}).IsEnabled())
}