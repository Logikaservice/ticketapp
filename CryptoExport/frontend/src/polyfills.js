// polyfills.js
// Polyfills for ES2023 Array methods
// Ensures compatibility with older browsers and environments that don't support these methods natively.

if (!Array.prototype.toSorted) {
    Array.prototype.toSorted = function (compareFn) {
        const copy = this.slice();
        copy.sort(compareFn);
        return copy;
    };
}

if (!Array.prototype.toReversed) {
    Array.prototype.toReversed = function () {
        const copy = this.slice();
        copy.reverse();
        return copy;
    };
}

if (!Array.prototype.toSpliced) {
    Array.prototype.toSpliced = function (start, deleteCount, ...items) {
        const copy = this.slice();
        copy.splice(start, deleteCount, ...items);
        return copy;
    };
}

if (!Array.prototype.with) {
    Array.prototype.with = function (index, value) {
        const copy = this.slice();
        copy[index] = value;
        return copy;
    };
}
