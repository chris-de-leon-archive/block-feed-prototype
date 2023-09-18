import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const maxFuncsPerConsumer = utils.getRequiredEnvVar("MAX_FUNCS_PER_CONSUMER")
  return {
    maxFuncsPerConsumer: parseInt(maxFuncsPerConsumer, 10),
  }
}
