import { ContactForm } from "./forms/contact.form"
import { useReducer } from "react"

type ContactUsState = Readonly<{
  isCompleted: boolean
  error: Error | null
}>

export function ContactUs() {
  const [state, setState] = useReducer(
    (currState: ContactUsState, nextState: ContactUsState) => {
      return {
        ...currState,
        ...nextState,
      }
    },
    {
      isCompleted: false,
      error: null,
    },
  )

  return (
    <section className="section bg-landing text-white">
      <div className="container mx-auto">
        {state.isCompleted ? (
          <div className="flex flex-col items-center gap-y-5">
            <h2 className="text-center text-3xl font-bold md:text-5xl">
              {state.error == null
                ? "Thank You for Contacting Us!"
                : "An Error Occurred While Processing Your Request"}
            </h2>
            <p className="text-center text-2xl opacity-50 md:text-3xl">
              {state.error == null
                ? "We have received your request and will follow up as soon as possible"
                : "Please try again later"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-between gap-y-9 md:w-full md:flex-row md:gap-y-0">
            <div className="flex w-full flex-col gap-y-9 md:w-1/2">
              <div className="flex flex-col items-center gap-y-2 md:items-start">
                <h2 className="text-blue-glow text-xl text-sky-blue">
                  Contact
                </h2>
                <h3 className="text-center text-5xl font-bold md:text-left">
                  Get in Touch
                </h3>
              </div>
              <div className="flex flex-col gap-y-3">
                <p className="text-center text-lg opacity-50 md:max-w-md md:text-left">
                  Have a feature request or general question? Or perhaps
                  you&apos;d like to speak to an expert. If this is the case,
                  please reach out to us! Get all your questions answered, see a
                  live walkthrough of the app, learn which pricing plan best
                  suits your needs, and more!
                </p>
              </div>
            </div>
            <div className="w-full md:w-1/2">
              <ContactForm
                onParseError={(err) => {
                  console.error(err)
                  setState({
                    isCompleted: true,
                    error: err,
                  })
                }}
                onSuccess={() => {
                  setState({
                    isCompleted: true,
                    error: null,
                  })
                }}
                onError={(err) => {
                  console.error(err)
                  setState({
                    isCompleted: true,
                    error: err,
                  })
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
