package testutils

import (
	"context"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
	"testing"

	"github.com/docker/go-connections/nat"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	MONGO_READWRITE_PWORD  = "password"
	MONGO_READWRITE_UNAME  = "readwrite"
	MONGO_READONLY_PWORD   = "password"
	MONGO_READONLY_UNAME   = "readonly"
	MONGO_ROOT_PASSWORD    = "password"
	MONGO_ROOT_USERNAME    = "root"
	MONGO_REPLICA_SET_NAME = "rs0"
	MONGO_DB               = "test"
	MONGO_PORT             = "27017/tcp"

	DEFAULT_MYSQL_ROOT_PASSWORD = "password"
	DEFAULT_MYSQL_ROOT_USERNAME = "root"
	DEFAULT_MYSQL_DB            = "test"
	MYSQL_PORT                  = "3306/tcp"

	REDIS_PORT = "6379/tcp"
)

type (
	HostConnectionInfo struct {
		Url  string
		Host string
		Port nat.Port
	}

	ContainerWithConnectionInfo struct {
		Container testcontainers.Container
		Conn      *HostConnectionInfo
	}
)

func NewMySqlContainer(ctx context.Context, t *testing.T, version string) (*ContainerWithConnectionInfo, error) {
	// Gets the directory that this file exists in
	dir, err := GetCurrentDir()
	if err != nil {
		return nil, err
	}

	// Creates the container
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			ExposedPorts: []string{MYSQL_PORT},
			WaitingFor:   wait.ForExposedPort(),
			FromDockerfile: testcontainers.FromDockerfile{
				Context:    path.Join(*dir, "..", "..", "..", "vendor", "mysql"),
				Dockerfile: path.Join("Dockerfile"),
				Repo:       "mysql-dev",
				Tag:        version,
				BuildArgs: map[string]*string{
					"MYSQL_VERSION": &version,
				},
			},
			Env: map[string]string{
				"MYSQL_ROOT_PASSWORD": DEFAULT_MYSQL_ROOT_PASSWORD,
				"MYSQL_DATABASE":      DEFAULT_MYSQL_DB,
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
	conn, err := GetConnectionInfo(ctx, container, nat.Port(MYSQL_PORT))
	if err != nil {
		return nil, err
	}

	// The default URL allows superuser access
	conn.Url = MySqlUrl(*conn, DEFAULT_MYSQL_ROOT_USERNAME, DEFAULT_MYSQL_ROOT_PASSWORD)

	// Returns the container info
	return &ContainerWithConnectionInfo{
		Container: container,
		Conn:      conn,
	}, nil
}

func NewMongoContainer(ctx context.Context, t *testing.T, version string, debug bool) (*ContainerWithConnectionInfo, error) {
	// Gets the directory that this file exists in
	dir, err := GetCurrentDir()
	if err != nil {
		return nil, err
	}

	// Creates the container
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			ExposedPorts: []string{MONGO_PORT},
			WaitingFor:   wait.ForExposedPort(),
			FromDockerfile: testcontainers.FromDockerfile{
				Context:    path.Join(*dir, "..", "..", "..", "vendor", "mongodb"),
				Dockerfile: path.Join("Dockerfile"),
				Repo:       "mongo-dev",
				Tag:        version,
				BuildArgs: map[string]*string{
					"MONGO_VERSION": &version,
				},
			},
			Env: map[string]string{
				"MONGO_AUTO_INIT":        strconv.FormatBool(false),
				"MONGO_REPLICA_SET_NAME": MONGO_REPLICA_SET_NAME,
				"MONGO_READWRITE_UNAME":  MONGO_READWRITE_UNAME,
				"MONGO_READWRITE_PWORD":  MONGO_READWRITE_PWORD,
				"MONGO_READONLY_UNAME":   MONGO_READONLY_UNAME,
				"MONGO_READONLY_PWORD":   MONGO_READONLY_PWORD,
				"MONGO_ROOT_UNAME":       MONGO_ROOT_USERNAME,
				"MONGO_ROOT_PWORD":       MONGO_ROOT_PASSWORD,
				"MONGO_DB":               MONGO_DB,
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
	conn, err := GetConnectionInfo(ctx, container, nat.Port(MONGO_PORT))
	if err != nil {
		return nil, err
	}

	// The default URL allows superuser access
	conn.Url = MongoUrl(*conn, MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD)

	// Runs the initialization script manually and passes in the random port obtained via the testcontainer package
	output, err := Dexec(ctx, container, []string{"bash", "/docker/setup.sh", conn.Port.Port()})
	if err != nil {
		return nil, err
	} else {
		if debug {
			fmt.Println(*output)
		}
	}

	// // Creates a root user
	// output, err = Dexec(ctx, container, []string{
	// 	"mongosh",
	// 	"mongodb://localhost:27017/admin?directConnection=true",
	// 	"--quiet",
	// 	"--eval",
	// 	fmt.Sprintf(
	// 		"db.createUser({ user: '%s', pwd: '%s', roles: [{ role:'root', db:'admin' }] })",
	// 		MONGO_ROOT_USERNAME,
	// 		MONGO_ROOT_PASSWORD,
	// 	),
	// 	"--json", "relaxed",
	// })
	// if err != nil {
	// 	return nil, err
	// } else {
	// 	if debug {
	// 		fmt.Println(*output)
	// 	}
	// }

	// Returns the container info
	return &ContainerWithConnectionInfo{
		Container: container,
		Conn:      conn,
	}, nil
}

func NewRedisContainer(ctx context.Context, t *testing.T, version string, cmd []string) (*ContainerWithConnectionInfo, error) {
	// Creates the container
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        fmt.Sprintf("redis:%s", version),
			ExposedPorts: []string{REDIS_PORT},
			WaitingFor:   wait.ForExposedPort(),
			Cmd:          cmd,
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
	conn, err := GetConnectionInfo(ctx, container, nat.Port(REDIS_PORT))
	if err != nil {
		return nil, err
	}

	// Returns the container info
	return &ContainerWithConnectionInfo{
		Container: container,
		Conn:      conn,
	}, nil
}

func RedisDefaultCmd() []string {
	return []string{
		"redis-server",
		"--port", "6379",
		"--loglevel", "debug",
	}
}

func RedisCacheCmd() []string {
	// https://redis.uptrace.dev/guide/go-redis-cache.html#redis-config
	return append(RedisDefaultCmd(), []string{
		"--maxmemory", "1000mb",
		"--maxmemory-policy", "allkeys-lfu",
		"--activedefrag", "yes",
		"--save", "\"\"",
	}...)
}

func RedisQueueCmd() []string {
	return append(RedisDefaultCmd(), []string{
		"--maxmemory", "0", // no memory limit
		"--maxmemory-policy", "noeviction",
		"--appendonly", "yes",
	}...)
}

func MySqlUrl(conn HostConnectionInfo, uname string, pword string) string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true",
		uname,
		pword,
		"host.docker.internal",
		conn.Port.Port(),
		DEFAULT_MYSQL_DB,
	)
}

func MongoUrl(conn HostConnectionInfo, uname string, pword string) string {
	return fmt.Sprintf(
		"mongodb://%s:%s@%s:%s/?compressors=zlib&replicaSet=%s",
		uname,
		pword,
		"host.docker.internal",
		conn.Port.Port(),
		MONGO_REPLICA_SET_NAME,
	)
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
	// Cleans up the container when the test case finishes
	t.Cleanup(func() {
		if err := container.Terminate(context.Background()); err != nil {
			t.Log(err)
		}
	})
}

func Dexec(ctx context.Context, container testcontainers.Container, cmd []string) (*string, error) {
	// Prints the unified command
	fmt.Println(strings.Join(cmd, " "))

	// Executes the command
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
