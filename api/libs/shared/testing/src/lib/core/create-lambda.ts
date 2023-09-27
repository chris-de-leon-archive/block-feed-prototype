import { CreateRoleCommand, IAMClient } from "@aws-sdk/client-iam"
import { withZippedCode } from "./with-zipped-code"
import { randomUUID } from "node:crypto"
import * as util from "node:util"
import * as fs from "node:fs"
import {
  CreateFunctionCommand,
  LambdaClient,
  PackageType,
  Runtime,
} from "@aws-sdk/client-lambda"

export const createLambda = async (
  iam: IAMClient,
  lambda: LambdaClient,
  code: string
) => {
  // Defines the name of the lambda role and lambda function
  const uuid = randomUUID()

  // Creates an IAM role for the lambda function
  const data = await iam.send(
    new CreateRoleCommand({
      RoleName: uuid,
      AssumeRolePolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
    })
  )

  // Check that the arn exists
  const arn = data.Role?.Arn
  if (arn == null) {
    throw new Error(
      `arn is null or undefined:\n${JSON.stringify(data, null, 2)}`
    )
  }

  // Creates a lambda function
  return await withZippedCode(code, async (filepath) => {
    const zippedFile = await util.promisify(fs.readFile)(filepath)
    return {
      id: uuid,
      res: await lambda.send(
        new CreateFunctionCommand({
          FunctionName: uuid,
          Runtime: Runtime.nodejs18x,
          Role: arn,
          Handler: "handler.handler",
          Code: {
            ZipFile: zippedFile,
          },
          PackageType: PackageType.Zip,
          EphemeralStorage: {
            Size: 512, // in MB
          },
        })
      ),
    }
  })
}
