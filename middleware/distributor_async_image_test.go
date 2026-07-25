package middleware

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestAsyncImageChannelSelectionUsesSynchronousCapability(t *testing.T) {
	const modelName = "agnes-image-2.1-flash"
	channel := &model.Channel{Type: constant.ChannelTypeAdvancedCustom}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		AdvancedCustom: &dto.AdvancedCustomConfig{
			Routes: []dto.AdvancedCustomRoute{
				{
					IncomingPath: "/v1/images/generations",
					UpstreamPath: "/v1/images/generations",
					Models:       []string{modelName},
				},
			},
		},
	})

	requestPath := channelSelectionRequestPath("/v1/images/generations/async")

	assert.Equal(t, "/v1/images/generations", requestPath)
	assert.True(t, channelSupportsRequestPath(channel, requestPath, modelName))
}
