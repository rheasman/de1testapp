export type Success = {
  success : true
}

export type SuccessfulOptionWithResult<T> = {
  success : true,
  result : T
}

export type Failure = {
  success : false
}

export type FailedOptionWithError<E> = {
  success : false,
  error : E
}

/**
 * An ErrorOption is intended to return typesafe information about the success or
 * failure of an operation. If the operation succeeds, .success is true, and .result exists
 * and contains the result of the operation. If the operation fails, .success is false, and .error
 * exists and contains an error describing the problem. T is the result type, and E is the error type.
 */
export type FullOption<T,E> = SuccessfulOptionWithResult<T> | FailedOptionWithError<E>


/**
 * A SuccessOption is intended to return typesafe information about the success or
 * failure of an operation, in the case where there is nothing to return if the operation succeeds.
 * 
 * If the operation succeeds, .success is true, and there are no other fields in the option.
 * If the operation fails, .success is false, and .error exists and contains an error
 * describing the problem. E is the error type.
 */
 export type SuccessOption<E> = Success | FailedOptionWithError<E>

/**
 * A SimpleOption is intended to return typesafe information about the success or
 * failure of an operation, in the case where there is nothing to return if the operation fails.
 * 
 * If the operation succeeds, .success is true, and .result contains the results of the operation.
 * If the operation fails, .success is false, and there are no other fields.
 */

 export type SimpleOption<T> = SuccessfulOptionWithResult<T> | Failure
