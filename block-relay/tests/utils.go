package tests

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/docker/go-connections/nat"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

type (
	HostConnectionInfo struct {
		Url  string
		Host string
		Port nat.Port
	}

	RabbitMQContainer struct {
		Container testcontainers.Container
		Stream    *HostConnectionInfo
		Amqp      *HostConnectionInfo
	}

	RedisContainer struct {
		Container testcontainers.Container
		Cache     *HostConnectionInfo
	}
)

func NewRedisContainer(ctx context.Context, t *testing.T, version string) (*RedisContainer, error) {
	// Defines the container ports to expose
	const REDIS_PORT = "6379/tcp"

	// Creates the container
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        fmt.Sprintf("redis:%s", version),
			ExposedPorts: []string{REDIS_PORT},
			WaitingFor:   wait.ForLog("Ready to accept connections"),
			Cmd: []string{
				"redis-server",
				"--port",
				"6379",
				"--loglevel",
				"debug",
				"--maxmemory",
				"100mb",
				"--maxmemory-policy",
				"allkeys-lfu",
				"--activedefrag",
				"yes",
				"--save",
				"\"\"",
			},
		},
		Started: true,
	})

	// Schedules the container for termination once the test case is completed
	if err != nil {
		return nil, err
	} else {
		ScheduleContainerTermination(t, container)
	}

	// Gets the connection info of the container
	conn, err := GetConnectionInfo(ctx, container, REDIS_PORT)
	if err != nil {
		return nil, err
	}

	// Returns the container info
	return &RedisContainer{
		Container: container,
		Cache:     conn,
	}, nil
}

func NewRabbitMQContainer(ctx context.Context, t *testing.T, version string) (*RabbitMQContainer, error) {
	// Defines the container ports to expose
	const (
		STREAM_PORT = "5552/tcp"
		AMQP_PORT   = "5672/tcp"
	)

	// Creates the container
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        fmt.Sprintf("rabbitmq:%s", version),
			ExposedPorts: []string{AMQP_PORT, STREAM_PORT},
			WaitingFor:   wait.ForLog("Server startup complete"),
			Entrypoint:   []string{"sh", "-c", "rabbitmq-plugins enable --offline rabbitmq_stream && rabbitmq-server"},
		},
		Started: true,
	})

	// Schedules the container for termination once the test case is completed
	if err != nil {
		return nil, err
	} else {
		ScheduleContainerTermination(t, container)
	}

	// Gets the STREAM connection info of the container
	streamConn, err := GetConnectionInfo(ctx, container, STREAM_PORT)
	if err != nil {
		return nil, err
	}

	// Gets the AMQP connection info of the container
	amqpConn, err := GetConnectionInfo(ctx, container, AMQP_PORT)
	if err != nil {
		return nil, err
	}

	// Configures the RabbitMQ stream
	out, err := Dexec(ctx, container, []string{
		"touch /etc/rabbitmq/rabbitmq.conf",
		"echo \"loopback_users = none\" >> /etc/rabbitmq/rabbitmq.conf",
		fmt.Sprintf("echo \"stream.advertised_port = %s\" >> /etc/rabbitmq/rabbitmq.conf", streamConn.Port.Port()),
		"echo \"stream.advertised_host = localhost\" >> /etc/rabbitmq/rabbitmq.conf",
		"cat /etc/rabbitmq/rabbitmq.conf",
		"rabbitmqctl stop_app",
		"rabbitmqctl start_app",
	})
	if err != nil {
		return nil, err
	} else {
		fmt.Println(*out)
	}

	// Reformats the URLs and returns the container info
	streamConn.Url = fmt.Sprintf("rabbitmq-stream://guest:guest@%s:%s", streamConn.Host, streamConn.Port.Port())
	amqpConn.Url = fmt.Sprintf("amqp://%s:%s", amqpConn.Host, amqpConn.Port.Port())
	return &RabbitMQContainer{
		Container: container,
		Stream:    streamConn,
		Amqp:      amqpConn,
	}, nil
}

func GetConnectionInfo(ctx context.Context, container testcontainers.Container, containerPort nat.Port) (*HostConnectionInfo, error) {
	// Fetches the container host
	host, err := container.Host(ctx)
	if err != nil {
		return nil, err
	}

	// Fetches the port on the host machine that the container is listening on
	port, err := container.MappedPort(ctx, containerPort)
	if err != nil {
		return nil, err
	}

	// Returns the connection info to use for testing
	return &HostConnectionInfo{
		Url:  fmt.Sprintf("%s:%s", host, port.Port()),
		Host: host,
		Port: port,
	}, nil
}

func ScheduleContainerTermination(t *testing.T, container testcontainers.Container) {
	// Clean up the container when the test case finishes
	t.Cleanup(func() {
		if err := container.Terminate(context.Background()); err != nil {
			t.Error(err)
		}
	})
}

func Dexec(ctx context.Context, container testcontainers.Container, cmds []string) (*string, error) {
	// Joins the commands together into one unified command
	cmd := []string{
		"sh",
		"-c",
		strings.Join(cmds, " && "),
	}

	// Prints the unified command
	fmt.Println(strings.Join(cmd, " "))

	// Executes the unified command
	_, reader, err := container.Exec(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// Fetches log output
	buf := new(strings.Builder)
	_, err = io.Copy(buf, reader)
	if err != nil {
		return nil, err
	}

	// Returns output as a string
	output := buf.String()
	return &output, nil
}
