package blockchains

const (
	ETH_TESTNET_SEPOLIA ChainID = "eth-testnet-sepolia"
	ETH_TESTNET_GOERLI  ChainID = "eth-testnet-goerli"
	ETH_MAINNET         ChainID = "eth-mainnet"
	FLOW_MAINNET        ChainID = "flow-mainnet"
	FLOW_TESTNET        ChainID = "flow-testnet"
)

type (
	BlockchainOpts struct {
		ChainUrl string
		ChainID  ChainID
	}

	ChainID string
)
