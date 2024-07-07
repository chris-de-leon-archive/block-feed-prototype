package validation

import (
	"errors"

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

func Validator() *validator.Validate {
	return validate
}

func Translator() ut.Translator {
	return trans
}

func ValidateStruct[T any](s T) error {
	if err := validate.Struct(s); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok && len(validationErrors) > 0 {
			return errors.New(validationErrors[0].Translate(trans))
		} else {
			return err
		}
	}
	return nil
}
