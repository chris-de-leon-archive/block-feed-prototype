package consumers

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/config"
	"block-relay/src/libs/relayer"
	"context"
	"log"
	"os"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ses"
	"github.com/aws/aws-sdk-go-v2/service/ses/types"
)

type (
	RawSMTPConsumerOpts struct {
		ReceiverEmail string `env:"RELAYER_SMTP_RECEIVER_EMAIL"`
		SenderEmail   string `env:"RELAYER_SMTP_SENDER_EMAIL"`
		RetryDelayMs  string `env:"RELAYER_SMTP_RETRY_DELAY_MS"`
		MaxRetries    string `env:"RELAYER_SMTP_MAX_RETRIES"`
	}

	SMTPConsumerOpts struct {
		ReceiverEmail string `validate:"required"`
		SenderEmail   string `validate:"required"`
		RetryDelayMs  int    `validate:"required,gte=0"`
		MaxRetries    int    `validate:"required,gte=0"`
	}
)

func SMTPConsumer() func(ctx context.Context, data relayer.RelayerQueueData) error {
	// Creates a logger
	logger := log.New(os.Stdout, "[smtp] ", log.LstdFlags)

	// Creates an SES client
	sesClient := ses.NewFromConfig(config.GetAWSConfig())

	// Parses environment variables
	opts := common.ParseOpts[RawSMTPConsumerOpts, SMTPConsumerOpts](func(env *RawSMTPConsumerOpts) *SMTPConsumerOpts {
		return &SMTPConsumerOpts{
			RetryDelayMs:  common.PanicIfError(strconv.Atoi(env.RetryDelayMs)),
			MaxRetries:    common.PanicIfError(strconv.Atoi(env.MaxRetries)),
			ReceiverEmail: env.ReceiverEmail,
			SenderEmail:   env.SenderEmail,
		}
	})

	// Returns an SMTP consumer
	return func(ctx context.Context, data relayer.RelayerQueueData) error {
		// Sends an email
		_, err := common.RetryIfError[*ses.SendEmailOutput](
			opts.MaxRetries,
			common.ConstantDelay(opts.RetryDelayMs),
			func() (*ses.SendEmailOutput, error) {
				return sesClient.SendEmail(ctx, &ses.SendEmailInput{
					Source: aws.String(opts.SenderEmail),
					Destination: &types.Destination{
						ToAddresses: []string{opts.ReceiverEmail},
					},
					Message: &types.Message{
						Subject: &types.Content{
							Charset: aws.String(common.CHARSET),
							Data:    aws.String("Block Feed Data Notification"),
						},
						Body: &types.Body{
							Html: &types.Content{
								Charset: aws.String(common.CHARSET),
								Data:    aws.String(string(data.Block)),
							},
							Text: &types.Content{
								Charset: aws.String(common.CHARSET),
								Data:    aws.String(string(data.Block)),
							},
						},
					},
				})
			},
		)

		// Logs results
		logger.Printf("sent block %d to %s\n", data.Height, opts.ReceiverEmail)

		// Returns an error if any
		return err
	}
}
