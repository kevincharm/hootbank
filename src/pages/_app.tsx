import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import NoSSR from 'react-no-ssr'
import React, { ReactNode } from 'react'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { State, WagmiProvider } from 'wagmi'
import { config as wagmiConfig } from '../config/wagmi'
import { ChakraProvider } from '@chakra-ui/react'

// Setup queryClient
const queryClient = new QueryClient()

// Create modal
createWeb3Modal({
    wagmiConfig,
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID as string,
})

function Web3ModalProvider({
    children,
    initialState,
}: {
    children: ReactNode
    initialState?: State
}) {
    return (
        <WagmiProvider config={wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    )
}

export default function App({ Component, pageProps }: AppProps) {
    return (
        <NoSSR>
            <ChakraProvider>
                <Web3ModalProvider>
                    <Component {...pageProps} />
                </Web3ModalProvider>
            </ChakraProvider>
        </NoSSR>
    )
}
