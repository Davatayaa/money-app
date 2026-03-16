package response

import "github.com/labstack/echo/v4"

type BaseResponse struct {
	Status  bool        `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func Success(c echo.Context, code int, message string, data interface{}) error {
	return c.JSON(code, BaseResponse{
		Status:  true,
		Message: message,
		Data:    data,
	})
}

func Error(c echo.Context, code int, message string) error {
	return c.JSON(code, BaseResponse{
		Status:  false,
		Message: message,
		Data:    nil,
	})
}
