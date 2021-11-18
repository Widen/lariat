import type { Frame, FrameLocator, Locator, Page } from 'playwright-core'
import { enhance, NestedCollection } from './enhance'
import { Handle, isFrameLocator, isLocator } from './utils'

export interface ElementOptions {
  portal?: boolean
  frame?: string
}

export class Collection<T extends Handle = Locator> {
  constructor(public root: T) {}

  /**
   * Retrieve a locator to a given element on the page identified by the
   * selector. The locator is lazily initialized when retrieved to ensure that
   * the most current `root` element is used.
   *
   * If `options.portal` is set to true, the locator will be based off the
   * `frame`, rather than the `root` thus escaping from any collection nesting.
   * This is useful to represent a page structure whose visual appearance
   * differs from it's DOM structure.
   *
   * @param selector - The selector that identifies the element.
   * @param options - Options for how to build the locator.
   */
  protected el(selector: string, options?: ElementOptions): Locator {
    const root = options?.portal ? this.frame : this.root

    return options?.frame
      ? root.frameLocator(options.frame).locator(selector)
      : root.locator(selector)
  }

  /**
   * Nest another collection inside of the current collection. Locators in the
   * nested collection will be based on the `root` argument which can be
   * customized to be a selector, locator, page, etc.
   *
   * @param collection - Uninstantiated collection class to nest.
   * @param root - The root of the nested collection. This could be a static
   * string, an element from the parent collection, or the collection's frame.
   *
   * @example this.nest(TextField, '#my-text-field')
   * @example this.nest(TextField, this.form)
   * @example this.nest(TextField, this.frame)
   */
  protected nest<U>(
    collection: new (root: Locator | FrameLocator) => U,
    root: string | Locator | FrameLocator
  ): NestedCollection<U>
  protected nest<U, Root extends Page | Frame>(
    collection: new (root: Root) => U,
    root: Root
  ): U
  protected nest<U, Root extends Handle>(
    collection: new (root: Handle) => U,
    root: string | Root
  ): NestedCollection<U> | U {
    const rootElement = typeof root === 'string' ? this.el(root) : root
    const instance = new collection(rootElement)

    // If the root element is a locator, it can use the `nth`, `first`, and
    // `last` methods and thus it should be enhanced.
    return isLocator(rootElement)
      ? enhance(collection, rootElement, instance)
      : instance
  }

  /**
   * Returns the frame that the collection is attached to. This can be used when
   * nesting a collection if the nested collection's locators elements should
   * be based off the page or frame rather than the parent collection's root.
   *
   * If the root of the collection is a page, then the main frame of the page
   * will be returned.
   *
   * @example this.nest(TextField, this.frame)
   */
  public get frame(): Frame {
    return isLocator(this.root) || isFrameLocator(this.root)
      ? // Playwright doesn't currently expose the frame of a locator as a
        // public API, so for now we need to get the private property.
        (this.root as unknown as { _frame: Frame })._frame
      : 'mainFrame' in this.root
      ? this.root.mainFrame()
      : this.root
  }

  /**
   * Returns the page that the collection is attached to. This can be used when
   * you need to access page methods inside your collection utility methods. For
   * example, if a utility needs to access `page.mouse`, this will allow that.
   *
   * @example this.page.mouse.down()
   */
  public get page(): Page {
    return this.frame.page()
  }
}
