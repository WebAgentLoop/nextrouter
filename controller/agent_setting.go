package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/setting/agent_setting"
	"github.com/gin-gonic/gin"
)

func GetAgentSetting(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    agent_setting.GetAgentSetting(),
	})
}
