import { FaMagnifyingGlass, FaDollarSign, FaBell } from "react-icons/fa6"
import { GiStoneBridge, GiDatabase } from "react-icons/gi"
import { TbRobotFace } from "react-icons/tb"

export function Applications() {
  return (
    <div className="section bg-landing text-white">
      <div className="container mx-auto">
        <div className="flex flex-col justify-between gap-y-10">
          <div className="flex flex-col gap-y-5">
            <h2 className="text-blue-glow text-center text-xl text-sky-blue md:text-left">
              Applications
            </h2>
            <h3 className="max-w-2xl text-center text-5xl font-bold md:text-left">
              The Possibilities Are Endless
            </h3>
            <p className="max-w-xl text-center text-xl opacity-50 md:text-left">
              Build a wide assortment of applications ranging from simple
              event-driven apps to AI/ML powered systems and beyond
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-7 gap-y-7 md:grid-cols-3">
            {applications.map((application, i) => {
              return (
                <div
                  key={i}
                  className="flex flex-col rounded border border-sky-blue p-4 shadow-lg shadow-sky-blue"
                >
                  <div className="mb-4 text-6xl">{application.icon}</div>
                  <span className="mb-4 text-xl font-bold">
                    {application.title}
                  </span>
                  <p className="mb-4 text-justify opacity-50">
                    {application.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const applications = [
  {
    title: "Alerting and Notifications",
    description:
      "Stay ahead of the curve with our webhook service, delivering near real-time notifications for every blockchain transaction. Whether it's a security alert, transaction confirmation, or smart contract event, you'll never miss a beat. Experience the convenience of instant notifications tailored to your needs.",
    icon: <FaBell />,
  },
  {
    title: "Payment Systems",
    description:
      "Integrate our webhook service into your payment systems for instant alerts on transactions, ensuring that your business stays ahead of the game. Monitor every deposit, purchase, and in-game action as they are mined on the blockchain, providing real-time insights and operational efficiency.",
    icon: <FaDollarSign />,
  },
  {
    title: "Monitoring",
    description:
      "Build monitoring systems that deliver timely updates on blockchain activity to keep your operations running smoothly. From tracking network health to detecting anomalies and suspicious activities, our near real-time notifications ensure you're always in the know. Whether it's monitoring node performance, wallet balances, or consensus changes, our service provides the insights you need to maintain peak efficiency and security.",
    icon: <FaMagnifyingGlass />,
  },
  {
    title: "Bridging",
    description:
      "Forge seamless connections between different blockchain networks. Stay informed about cross-chain transactions, asset transfers, and protocol updates as they occur, enabling smooth interoperability between blockchain ecosystems. Whether you're managing decentralized finance (DeFi) protocols, decentralized exchanges (DEXs), or multi-chain applications, our service ensures seamless communication for building blockchain bridges, facilitating frictionless asset transfers and protocol interactions.",
    icon: <GiStoneBridge />,
  },
  {
    title: "Streaming / ETL",
    description:
      "Seamlessly integrate blockchain data into your systems with automated precision, ensuring a steady flow of actionable insights for informed decision-making. Whether you're aggregating transactional data for compliance reporting, optimizing inventory management, or analyzing market trends, our service streamlines the entire streaming / ETL process. Elevate your streaming / ETL pipelines to new heights and unlock the full potential of your data infrastructure today.",
    icon: <GiDatabase />,
  },
  {
    title: "AI/ML",
    description:
      "Build revolutionary AI and ML models that redefine the boundaries of possibility. Unlock the full potential of blockchain data for your analytics and predictive modeling endeavors. Seamlessly integrate blockchain insights into your algorithms to uncover hidden patterns, predict market movements, and optimize decision-making like never before. Don't just analyze data—transform it into actionable intelligence that drives innovation and propels your organization.",
    icon: <TbRobotFace />,
  },
]
