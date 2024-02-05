package common

import (
	"errors"
	"fmt"
	"log"
	"runtime"

	"github.com/caarlos0/env/v10"
	locales_en "github.com/go-playground/locales/en"
	ut "github.com/go-playground/universal-translator"
	"github.com/go-playground/validator/v10"
	translations_en "github.com/go-playground/validator/v10/translations/en"
)

const (
	CHARSET = "UTF-8"
)

var (
	validate = validator.New(validator.WithRequiredStructEnabled())
	en_local = locales_en.New()
	trans, _ = ut.New(en_local, en_local).GetTranslator("en")
)

func init() {
	// Makes errors more human-readable
	translations_en.RegisterDefaultTranslations(validate, trans)
}

func LoadEnvVars[T any]() (*T, error) {
	var envvars T

	opts := env.Options{
		OnSet: func(tag string, value any, isDefault bool) {
			fmt.Printf("Set %s to %v (default? %v)\n", tag, value, isDefault)
		},
	}

	if err := env.ParseWithOptions(&envvars, opts); err != nil {
		return nil, err
	}

	if err := ValidateStruct[T](envvars); err != nil {
		return nil, err
	}

	return &envvars, nil
}

func ValidateStruct[T any](s T) error {
	if err := validate.Struct(s); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			if len(validationErrors) > 0 {
				return errors.New(validationErrors[0].Translate(trans))
			}
		}
		return err
	}
	return nil
}

func LogError(logger *log.Logger, err error) {
	_, file, line, ok := runtime.Caller(1)
	if !ok {
		file = "unknown"
		line = -1
	}

	msg := "Error at %s:%d - %v\n"
	if logger == nil {
		fmt.Printf(msg, file, line, err)
	} else {
		logger.Printf(msg, file, line, err)
	}
}
