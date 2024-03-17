'use client'
import { Box, Button, Input, Text } from '@chakra-ui/react'
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import DelayABI from '../abis/Delay'
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from 'viem'
import {
    OrderQuoteSideKindSell,
    SigningScheme,
    COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS,
    OrderBookApi,
} from '@cowprotocol/cow-sdk'
import GPv2SettlementABI from '../abis/GPv2Settlement'
import { useMutation, useQuery } from '@tanstack/react-query'
import { use, useEffect, useState } from 'react'

const chainId = 100
const orderBookApi = new OrderBookApi({ chainId })

interface OrderProps {
    safeAddress: `0x${string}`
    delayModuleAddress: `0x${string}`
    sellToken: `0x${string}`
    buyToken: `0x${string}`
    onClose?: () => void
}

export function Order({
    safeAddress,
    delayModuleAddress,
    sellToken,
    buyToken,
    onClose,
}: OrderProps) {
    const [sellAmount, setSellAmount] = useState<string>('')

    const { data: txCooldown } = useReadContract({
        address: delayModuleAddress,
        abi: DelayABI,
        functionName: 'txCooldown',
        query: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
        },
    })

    const { data: sellTokenSymbol } = useReadContract({
        address: sellToken,
        abi: erc20Abi,
        functionName: 'symbol',
    })
    const { data: sellTokenDecimals } = useReadContract({
        address: sellToken,
        abi: erc20Abi,
        functionName: 'decimals',
    })
    const { data: buyTokenSymbol } = useReadContract({
        address: buyToken,
        abi: erc20Abi,
        functionName: 'symbol',
    })
    const { data: buyTokenDecimals } = useReadContract({
        address: buyToken,
        abi: erc20Abi,
        functionName: 'decimals',
    })

    const { data: quote } = useQuery({
        queryKey: ['getQuote', safeAddress, delayModuleAddress, sellAmount] as const,
        queryFn: async (q) => {
            const [, safeAddress, , sellAmount] = q.queryKey
            if (!sellAmount) return null
            const parsedSellAmount = parseUnits(sellAmount, 18 /** EURe decimals */).toString()
            const { quote } = await orderBookApi.getQuote({
                sellToken,
                buyToken,
                from: safeAddress,
                receiver: safeAddress,
                sellAmountBeforeFee: parsedSellAmount,
                kind: OrderQuoteSideKindSell.SELL,
            })
            return quote
        },
        // refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
    })

    const {
        writeContract: _queuePreSign,
        status: queuePreSignStatus,
        reset: resetQueuePreSign,
        data: queuePreSignTxHash,
    } = useWriteContract()
    const {
        mutate: sendOrder,
        data: sendOrderData,
        reset: resetSendOrder,
        status: sendOrderStatus,
    } = useMutation({
        mutationKey: ['orderData', quote],
        mutationFn: async () => {
            if (!quote) return null
            const orderId = await orderBookApi.sendOrder({
                ...quote,
                from: safeAddress,
                receiver: safeAddress,
                signature: '0x',
                signingScheme: SigningScheme.PRESIGN,
            })

            console.log(`Order id: ${orderId}`)

            return {
                orderId,
                preSignCalldata: encodeFunctionData({
                    abi: GPv2SettlementABI,
                    functionName: 'setPreSignature',
                    args: [orderId as `0x${string}`, true],
                }),
            }
        },
    })
    const { orderId, preSignCalldata } = sendOrderData || {}

    useEffect(() => {
        if (!preSignCalldata) return
        _queuePreSign({
            address: delayModuleAddress,
            abi: DelayABI,
            functionName: 'execTransactionFromModule',
            args: [
                COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS[chainId] as `0x${string}`,
                0n,
                preSignCalldata,
                0 /** call */,
            ],
        })
    }, [delayModuleAddress, preSignCalldata])

    const { writeContract: _execPreSign, status: execPreSignStatus } = useWriteContract({
        mutation: {
            onSuccess() {
                onClose?.()
            },
        },
    })
    const execPreSign = () => {
        if (!preSignCalldata || !txCooldown) return
        console.log('Executing presign...')
        _execPreSign({
            address: delayModuleAddress,
            abi: DelayABI,
            functionName: 'executeNextTx',
            args: [
                COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS[chainId] as `0x${string}`,
                0n,
                preSignCalldata,
                0 /** call */,
            ],
        })
    }

    const { data: order } = useQuery({
        queryKey: ['order', orderId] as const,
        queryFn: async (q) => {
            const [, orderId] = q.queryKey
            if (!orderId) return null
            const order = await orderBookApi.getOrder(orderId)
            return order
        },
        refetchInterval: 5000,
        enabled: Boolean(orderId),
    })
    useEffect(() => {
        if (!order) return
        if (
            order.status === 'fulfilled' ||
            order.status === 'cancelled' ||
            order.status === 'expired'
        ) {
            onClose?.()
        }
    }, [order])

    return (
        <Box>
            <Input
                type="text"
                placeholder="Amount"
                value={sellAmount}
                onChange={(event) => {
                    setSellAmount(event.target.value)
                }}
            />
            {quote && (
                <Box py={2}>
                    {sellTokenDecimals && buyTokenDecimals && (
                        <Text>
                            Sell {formatUnits(BigInt(quote.sellAmount), sellTokenDecimals)}{' '}
                            {sellTokenSymbol}, get{' '}
                            {formatUnits(BigInt(quote.buyAmount), buyTokenDecimals)}{' '}
                            {buyTokenSymbol}
                        </Text>
                    )}
                </Box>
            )}
            <Box py={4}>
                <Button
                    onClick={() => sendOrder?.()}
                    isLoading={
                        sendOrderStatus === 'pending' ||
                        queuePreSignStatus === 'pending' ||
                        execPreSignStatus === 'pending'
                    }
                    disabled={!quote || sendOrderStatus !== 'idle' || queuePreSignStatus !== 'idle'}
                >
                    Send Order
                </Button>
                {queuePreSignStatus === 'success' && (
                    <Button
                        onClick={() => execPreSign()}
                        isLoading={execPreSignStatus === 'pending'}
                        disabled={execPreSignStatus !== 'idle'}
                    >
                        Execute Order
                    </Button>
                )}
            </Box>
            {order && (
                <Box>
                    <Box>Order status: {order.status}</Box>
                    <Box>
                        <a
                            href={`https://explorer.cow.fi/gc/orders/${order.uid}`}
                            target="_blank"
                            referrerPolicy="no-referrer"
                        >
                            Explorer
                        </a>
                    </Box>
                </Box>
            )}
        </Box>
    )
}
