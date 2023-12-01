package config

import (
	"block-relay/src/libs/common"
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
)

type (
	RawAwsOpts struct {
		SecretAccessKey string `env:"AWS_SECRET_ACCESS_KEY"`
		AccessKeyID     string `env:"AWS_ACCESS_KEY_ID"`
		Region          string `env:"AWS_REGION"`
		Url             string `env:"AWS_URL"`
	}

	AwsOpts struct {
		SecretAccessKey string `validate:"required"`
		AccessKeyID     string `validate:"required"`
		Region          string `validate:"required"`
		Url             string
	}
)

func GetAWSConfig() aws.Config {
	// Parses environment variables
	opts := common.ParseOpts[RawAwsOpts, AwsOpts](func(env *RawAwsOpts) *AwsOpts {
		return &AwsOpts{
			SecretAccessKey: env.SecretAccessKey,
			AccessKeyID:     env.AccessKeyID,
			Region:          env.Region,
			Url:             env.Url,
		}
	})

	// Creates an AWS endpoint resolver
	resolver := aws.EndpointResolverWithOptionsFunc(func(_, region string, _ ...interface{}) (aws.Endpoint, error) {
		if opts.Url != "" {
			return aws.Endpoint{
				PartitionID:   "aws",
				URL:           opts.Url,
				SigningRegion: region,
			}, nil
		}

		// returning EndpointNotFoundError will allow the service to fallback to its default resolution
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	// Return the config
	return common.PanicIfError(config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion(opts.Region),
		config.WithEndpointResolverWithOptions(resolver),
	))
}
