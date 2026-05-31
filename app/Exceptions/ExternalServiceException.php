<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

class ExternalServiceException extends RuntimeException
{
    public function __construct(
        public readonly string $service,
        public readonly string $operation,
        string $safeMessage,
        public readonly ?string $providerCode = null,
        public readonly bool $retryable = true,
        public readonly array $context = [],
        ?Throwable $previous = null,
    ) {
        parent::__construct($safeMessage, 0, $previous);
    }

    public function referenceCode(): string
    {
        return strtoupper($this->service).'-'.strtoupper(str_replace('_', '-', $this->operation));
    }

    public function safePayload(): array
    {
        return [
            'message' => $this->getMessage(),
            'service' => $this->service,
            'operation' => $this->operation,
            'code' => $this->providerCode,
            'reference' => $this->referenceCode(),
            'retryable' => $this->retryable,
        ];
    }
}
