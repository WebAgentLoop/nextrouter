package ticket_setting

import "github.com/QuantumNous/new-api/setting/config"

// TicketSetting 工单系统配置
type TicketSetting struct {
	Enabled bool `json:"enabled"` // 是否启用工单系统
}

// 默认配置：关闭，需管理员在系统设置中手动开启
var defaultTicketSetting = TicketSetting{
	Enabled: false,
}

var ticketSetting = defaultTicketSetting

func init() {
	config.GlobalConfig.Register("ticket_setting", &ticketSetting)
}

// GetTicketSetting 获取工单系统配置
func GetTicketSetting() *TicketSetting {
	return &ticketSetting
}

// IsTicketEnabled 是否启用工单系统
func IsTicketEnabled() bool {
	return ticketSetting.Enabled
}
