package testutils

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
	"testing"
	"time"

	// https://www.mongodb.com/docs/drivers/go/current/fundamentals/connections/network-compression/#compression-algorithm-dependencies
	_ "compress/zlib"

	"github.com/docker/go-connections/nat"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/compose"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	DOCKER_HOST = "host.docker.internal"

	MONGO_VERSION              = "7.0.5"
	MONGO_READWRITE_USER_UNAME = "readwrite"
	MONGO_READWRITE_USER_PWORD = "password"
	MONGO_READONLY_USER_UNAME  = "readonly"
	MONGO_READONLY_USER_PWORD  = "password"
	MONGO_ROOT_USER_UNAME      = "root"
	MONGO_ROOT_USER_PWORD      = "password"
	MONGO_REPLICA_SET_NAME     = "rs0"
	MONGO_DB                   = "test"
	MONGO_PORT                 = nat.Port("27017/tcp")

	TIMESCALEDB_VERSION               = "latest-pg16"
	TIMESCALEDB_BLOCKSTORE_USER_UNAME = "blockstore"
	TIMESCALEDB_BLOCKSTORE_USER_PWORD = "password"
	TIMESCALEDB_ROOT_USER_UNAME       = "root"
	TIMESCALEDB_ROOT_USER_PWORD       = "password"
	TIMESCALEDB_SCHEMA                = "test"
	TIMESCALEDB_DB                    = "test"
	TIMESCALEDB_PORT                  = nat.Port("5432/tcp")

	MYSQL_DEFAULT_CONN_POOL_SIZE = 13
	MYSQL_VERSION                = "8.3.0"
	MYSQL_WORKERS_USER_UNAME     = "workers_user"
	MYSQL_WORKERS_USER_PWORD     = "password"
	MYSQL_ROOT_USER_UNAME        = "root"
	MYSQL_ROOT_USER_PWORD        = "password"
	MYSQL_DB                     = "test"
	MYSQL_PORT                   = nat.Port("3306/tcp")

	REDIS_CLUSTER_MIN_NODES = 6

	REDIS_VERSION = "7.2.1-alpine3.18"
	REDIS_PORT    = nat.Port("6379/tcp")
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

func NewMySqlContainer(ctx context.Context, t *testing.T) (*ContainerWithConnectionInfo, error) {
	// Gets the absolute path to the repo's root directory
	dir, err := GetRootDir()
	if err != nil {
		return nil, err
	}

	// Creates the container
	version := MYSQL_VERSION
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			ExposedPorts: []string{MYSQL_PORT.Port()},
			WaitingFor:   wait.ForExposedPort(),
			FromDockerfile: testcontainers.FromDockerfile{
				Context:    path.Join(dir, "vendor", "mysql"),
				Dockerfile: "Dockerfile",
				Repo:       "mysql",
				Tag:        "dev",
				BuildArgs: map[string]*string{
					"MYSQL_VERSION": &version,
				},
			},
			Env: map[string]string{
				"MYSQL_ROOT_PASSWORD": MYSQL_ROOT_USER_PWORD,
				"MYSQL_DATABASE":      MYSQL_DB,
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
	conn, err := GetConnectionInfo(ctx, container, MYSQL_PORT)
	if err != nil {
		return nil, err
	}

	// The default URL allows superuser access
	conn.Url = MySqlUrl(*conn, MYSQL_ROOT_USER_UNAME, MYSQL_ROOT_USER_PWORD)

	// Returns the container info
	return &ContainerWithConnectionInfo{
		Container: container,
		Conn:      conn,
	}, nil
}

func NewTimescaleDBContainer(ctx context.Context, t *testing.T) (*ContainerWithConnectionInfo, error) {
	// Gets the absolute path to the repo's root directory
	dir, err := GetRootDir()
	if err != nil {
		return nil, err
	}

	// Creates the container
	version := TIMESCALEDB_VERSION
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			ExposedPorts: []string{TIMESCALEDB_PORT.Port()},
			WaitingFor:   wait.ForExposedPort(),
			FromDockerfile: testcontainers.FromDockerfile{
				Context:    path.Join(dir, "vendor", "timescaledb"),
				Dockerfile: "Dockerfile",
				Repo:       "timescaledb",
				Tag:        "dev",
				BuildArgs: map[string]*string{
					"PG_VERSION": &version,
				},
			},
			Env: map[string]string{
				"POSTGRES_PASSWORD": TIMESCALEDB_ROOT_USER_PWORD,
				"POSTGRES_USER":     TIMESCALEDB_ROOT_USER_UNAME,
				"POSTGRES_SCHEMA":   TIMESCALEDB_SCHEMA,
				"POSTGRES_DB":       TIMESCALEDB_DB,
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
	conn, err := GetConnectionInfo(ctx, container, TIMESCALEDB_PORT)
	if err != nil {
		return nil, err
	}

	// The default URL allows superuser access
	conn.Url = PostgresUrl(*conn, TIMESCALEDB_ROOT_USER_UNAME, TIMESCALEDB_ROOT_USER_PWORD)

	// Returns the container info
	return &ContainerWithConnectionInfo{
		Container: container,
		Conn:      conn,
	}, nil
}

func NewMongoContainer(ctx context.Context, t *testing.T, debug bool) (*ContainerWithConnectionInfo, error) {
	// Gets the absolute path to the repo's root directory
	dir, err := GetRootDir()
	if err != nil {
		return nil, err
	}

	// Creates the container
	version := MONGO_VERSION
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			ExposedPorts: []string{MONGO_PORT.Port()},
			WaitingFor:   wait.ForExposedPort(),
			FromDockerfile: testcontainers.FromDockerfile{
				Context:    path.Join(dir, "vendor", "mongodb"),
				Dockerfile: "Dockerfile",
				Repo:       "mongo",
				Tag:        "dev",
				BuildArgs: map[string]*string{
					"MONGO_VERSION": &version,
				},
			},
			Env: map[string]string{
				"MONGO_AUTO_INIT":        strconv.FormatBool(false),
				"MONGO_REPLICA_SET_NAME": MONGO_REPLICA_SET_NAME,
				"MONGO_READWRITE_UNAME":  MONGO_READWRITE_USER_UNAME,
				"MONGO_READWRITE_PWORD":  MONGO_READWRITE_USER_PWORD,
				"MONGO_READONLY_UNAME":   MONGO_READONLY_USER_UNAME,
				"MONGO_READONLY_PWORD":   MONGO_READONLY_USER_PWORD,
				"MONGO_ROOT_UNAME":       MONGO_ROOT_USER_UNAME,
				"MONGO_ROOT_PWORD":       MONGO_ROOT_USER_PWORD,
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
	conn, err := GetConnectionInfo(ctx, container, MONGO_PORT)
	if err != nil {
		return nil, err
	}

	// The default URL allows superuser access
	conn.Url = MongoUrl(*conn, MONGO_ROOT_USER_UNAME, MONGO_ROOT_USER_PWORD)

	// Runs the initialization script manually and passes in the random port obtained via the testcontainer package
	output, err := Dexec(ctx, container, []string{"bash", "/docker/setup.sh", conn.Port.Port()})
	if err != nil {
		return nil, err
	} else {
		if debug {
			fmt.Println(*output)
		}
	}

	// Example of running additional commands:
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

// NOTE: some important things to be aware of here:
//
//   - There's multiple ways to create a redis cluster, but for development purposes we'll use
//     an approach where we can host an entire cluster from one docker image. To do this, we'll
//     make use of the create-cluster script:
//
//     https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/#create-a-redis-cluster
//
//     Unfortunately, the official redis docker image does not come with this script. To get around this,
//     we could create an alpine container, install a stable redis distribution (which comes with this
//     script), and build redis from scratch within the container so that we can use this script to create
//     a redis cluster. However, a more straightforward way to accomplish the same result is to download
//     the script from the redis repo and copy it into a container that uses the official docker redis
//     image:
//
//     https://github.com/redis/redis/blob/7.2.4/utils/create-cluster/create-cluster
//
//     This way, the only thing we need to do is create and copy a config.sh file to the container, which
//     overrides the path to the directory that contains the redis-cli bin (which can be obtained by using
//     shell commands).
//
//   - Redis cluster is not fully compatible with port mappings:
//
//     https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/#redis-cluster-and-docker
//
//     According to the documentation, the only way to make this work is to use the --net=host option so that
//     the container ports align with the host ports. However, for WSL --net=host works slightly different:
//
//     https://github.com/docker/for-win/issues/6736#issuecomment-630015038
//
//     According to the link above, for WSL a port mapping can be used in place of the --net=host option but
//     only if the container ports exactly align with the host ports (e.g 7000:7000).
//
//   - testcontainers is heavily reliant on using randomized port mappings to ensure parallel running tests don't
//     have any port collisions. This is problematic because if the host and container ports are not aligned we will
//     run into connection issues with redis cluster. To get around this, we use the testcontainers compose module
//     and define a compose file that aligns the host and container ports. Unfortunately, the testcontainers compose
//     module does not support compose files that build custom images, so to work around this we use testcontainers
//     to build and create a container with our custom redis cluster image, but make sure it is never started. The
//     compose file will reference the image and actually run the container.
func NewRedisClusterContainer(ctx context.Context, t *testing.T, nodes int) (*ContainerWithConnectionInfo, error) {
	// Validates the number of nodes
	if nodes < REDIS_CLUSTER_MIN_NODES {
		return nil, errors.New("invalid number of nodes")
	}

	// Gets the absolute path to the repo's root directory
	dir, err := GetRootDir()
	if err != nil {
		return nil, err
	}

	// Defines the image name and image tag
	repo := "redis-cluster"
	tag := "dev"

	// Builds the redis cluster image and container, but does not start the container
	_, err = testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			FromDockerfile: testcontainers.FromDockerfile{
				Context:    path.Join(dir, "vendor", "redis-cluster"),
				Dockerfile: "Dockerfile",
				Repo:       repo,
				Tag:        tag,
			},
		},
		Started: false,
	})
	if err != nil {
		return nil, err
	}

	// Gets a docker compose client
	redisCluster, err := compose.NewDockerCompose(
		path.Join(dir, "vendor", "redis-cluster", "go.compose.yml"),
	)
	if err != nil {
		return nil, err
	}

	// Ensures the compose service(s) are cleaned up
	t.Cleanup(func() {
		if err := redisCluster.Down(context.Background(), compose.RemoveVolumes(true), compose.RemoveOrphans(true)); err != nil {
			t.Log(err)
		}
	})

	// Gets a random port that's available on the host machine
	randPort, err := GetFreePort()
	if err != nil {
		return nil, err
	}

	// Defines env variables for the compose file
	env := map[string]string{
		"REDIS_CLUSTER_IMAGE": fmt.Sprintf("%s:%s", repo, tag),
		"START_PORT":          fmt.Sprintf("%d", randPort),
		"END_PORT":            fmt.Sprintf("%d", randPort+nodes),
	}

	// Starts the compose service(s)
	if err := redisCluster.WithEnv(env).Up(ctx, compose.Wait(true)); err != nil {
		return nil, err
	}

	// Waits a bit longer for the redis cluster to fully start up
	time.Sleep(time.Duration(5) * time.Second)

	// Returns the connection info for one of the cluster nodes
	return &ContainerWithConnectionInfo{
		Container: nil,
		Conn: &HostConnectionInfo{
			Url:  fmt.Sprintf("%s:%d", DOCKER_HOST, randPort),
			Port: nat.Port(fmt.Sprintf("%d/tcp", randPort)),
			Host: DOCKER_HOST,
		},
	}, nil
}

func NewRedisContainer(ctx context.Context, t *testing.T, cmd []string) (*ContainerWithConnectionInfo, error) {
	// Creates the container
	version := REDIS_VERSION
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        fmt.Sprintf("redis:%s", version),
			ExposedPorts: []string{REDIS_PORT.Port()},
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
	conn, err := GetConnectionInfo(ctx, container, REDIS_PORT)
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
		"--port", REDIS_PORT.Port(),
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

func RedisBlockStoreCmd() []string {
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
		DOCKER_HOST,
		conn.Port.Port(),
		MYSQL_DB,
	)
}

func PostgresUrl(conn HostConnectionInfo, uname string, pword string) string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable&search_path=%s",
		uname,
		pword,
		DOCKER_HOST,
		conn.Port.Port(),
		TIMESCALEDB_DB,
		TIMESCALEDB_SCHEMA,
	)
}

func MongoUrl(conn HostConnectionInfo, uname string, pword string) string {
	return fmt.Sprintf(
		"mongodb://%s:%s@%s:%s/?compressors=zlib&replicaSet=%s",
		uname,
		pword,
		DOCKER_HOST,
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
